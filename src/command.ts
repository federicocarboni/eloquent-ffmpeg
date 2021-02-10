import { SpawnOptionsWithoutStdio, spawn as spawnChildProcess } from 'child_process';
import { createInterface as readlines } from 'readline';
import { Readable } from 'stream';
import { Server } from 'net';
import { types } from 'util';
import { createSocketServer, getSocketPath, getSocketURL } from './sock';
import { DEV_NULL, flatMap, isNullish, toReadableStream } from './utils';
import { probe } from './probe';
import { Process } from './process';
import {
  ConcatOptions,
  ConcatSource,
  FFmpegCommand,
  FFmpegInput,
  FFmpegLogger,
  FFmpegOptions,
  FFmpegOutput,
  FFmpegProcess,
  InputSource,
  LogLevel,
  OutputDestination,
  ProbeOptions,
  ProbeResult,
  SpawnOptions
} from './types';
import {
  escapeConcatFile,
  escapeFilterDescription,
  escapeTeeComponent,
  stringifyFilterDescription,
  stringifyObjectColonSeparated,
  stringifyValue
} from './string';

// Match the `[level]` segment inside an ffmpeg line.
const LEVEL_REGEX = /\[(trace|debug|verbose|info|warning|error|fatal)\]/;

// Turn an ffmpeg log level into its numeric representation.
const logLevelToN = {
  quiet: -8,
  panic: 0,
  fatal: 8,
  error: 16,
  warning: 24,
  info: 32,
  verbose: 40,
  debug: 48,
  trace: 56,
};

/**
 * Create a new FFmpegCommand.
 * @param options -
 * @public
 */
export function ffmpeg(options: FFmpegOptions = {}): FFmpegCommand {
  return new Command(options);
}

class Command implements FFmpegCommand {
  constructor(options: FFmpegOptions) {
    const { level, progress = true, overwrite = true } = options;
    this.args(overwrite ? '-y' : '-n');
    if (progress)
      this.args('-progress', 'pipe:1', '-nostats');
    this.args('-loglevel', `+repeat+level${level ? `+${level}` : ''}`);
  }
  #args: string[] = [];
  #inputs: Input[] = [];
  #outputs: Output[] = [];
  #inputStreams: [string, NodeJS.ReadableStream][] = [];
  #outputStreams: [string, NodeJS.WritableStream[]][] = [];

  input(source: InputSource): FFmpegInput {
    const [url, isStream, stream] = handleInputSource(source, this.#inputStreams);
    const input = new Input(url, isStream, stream);
    this.#inputs.push(input);
    return input;
  }
  concat(sources: ConcatSource[], options: ConcatOptions = {}): FFmpegInput {
    const { safe = false, protocols, useDataURI = true } = options;
    const inputStreams = this.#inputStreams;
    // Dynamically create an ffconcat file with the given directives.
    // https://ffmpeg.org/ffmpeg-all.html#concat-1
    const directives = ['ffconcat version 1.0'];
    const addFile = (source: InputSource) => {
      const [url] = handleInputSource(source, inputStreams);
      directives.push(`file ${escapeConcatFile(url)}`);
    };
    sources.forEach((source) => {
      // @ts-ignore
      if (typeof source === 'string' || types.isUint8Array(source) || typeof source[Symbol.asyncIterator] === 'function') {
        addFile(source as InputSource);
      } else {
        const { file, duration, inpoint, outpoint } = source as Exclude<ConcatSource, InputSource>;
        if (file !== void 0)
          addFile(file);
        if (duration !== void 0)
          directives.push(`duration ${duration}ms`);
        if (inpoint !== void 0)
          directives.push(`inpoint ${inpoint}ms`);
        if (outpoint !== void 0)
          directives.push(`outpoint ${outpoint}ms`);
        // TODO: add support for the directives file_packet_metadata, stream and exact_stream_id
      }
    });
    // Create the ffconcat script as a buffer.
    const ffconcat = Buffer.from(directives.join('\n'), 'utf8');

    let url: string;
    let isStream: boolean;
    let stream: NodeJS.ReadableStream | undefined;

    if (useDataURI) {
      // FFmpeg only accepts base64-encoded data urls.
      url = `data:text/plain;base64,${ffconcat.toString('base64')}`;
      isStream = false;
    } else {
      const path = getSocketPath();
      url = getSocketURL(path);
      isStream = true;
      stream = Readable.from([ffconcat], { objectMode: false });
      inputStreams.push([path, stream]);
    }

    const input = new Input(url, isStream, stream);

    // Add extra arguments to the input based on the given options
    // the option safe is NOT enabled by default because it doesn't
    // allow streams or protocols other than the currently used one,
    // which, depending on the platform, may be `file` (on Windows)
    // or `unix` (on every other platform).
    input.args('-safe', safe ? '1' : '0');
    // Protocol whitelist enables certain protocols in the ffconcat
    // file dynamically created by this method.
    if (protocols && protocols.length > 0)
      input.args('-protocol_whitelist', protocols.join(','));

    this.#inputs.push(input);
    return input;
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    let streams: NodeJS.WritableStream[];
    let isStream = false;
    const urls = destinations.map((dest) => {
      if (typeof dest === 'string')
        return dest;
      // When the output has to be written to multiple streams, we
      // we only use one unix socket / windows pipe by writing the
      // same output to multiple streams internally.
      if (!isStream) {
        isStream = true;
        streams = [dest];
        const path = getSocketPath();
        this.#outputStreams.push([path, streams]);
        return getSocketURL(path);
      }
      //
      streams.push(dest);
      return;
    }).filter((value): value is string => value !== void 0);

    // - If there are no urls the output will be discarded by
    //   using `/dev/null` or `NUL` as the destination.
    // - If there is only one url it will be given directly
    //   as the output url to ffmpeg.
    // - If there is more than one url, the `tee` protocol
    //   will be used.
    const url = urls.length === 0 ? DEV_NULL
      : urls.length === 1 ? urls[0]
      : `tee:${urls.map(escapeTeeComponent).join('|')}`;

    const output = new Output(url, isStream);
    this.#outputs.push(output);
    return output;
  }
  async spawn(options: SpawnOptions = {}): Promise<FFmpegProcess> {
    const { ffmpegPath = 'ffmpeg', spawnOptions, report = false, logger } = options;
    const args = this.getArgs();

    // Starts all socket servers needed to handle the streams.
    const [inputSocketServers, outputSocketServers] = await Promise.all([
      handleInputStreams(this.#inputStreams),
      handleOutputStreams(this.#outputStreams),
    ]);

    const cpSpawnOptions: SpawnOptionsWithoutStdio = {
      stdio: 'pipe',
      ...spawnOptions,
    };

    if (report) {
      let level: LogLevel | undefined;
      // FFREPORT can be either a ':' separated key-value pair which takes `file` and `level` as
      // options or any non-empty string which enables reporting with default options.
      // If no options are specified the string `true` is used.
      // https://ffmpeg.org/ffmpeg-all.html#Generic-options
      const FFREPORT = report !== true && stringifyObjectColonSeparated({
        file: report.file,
        level: isNullish(level = report.level) ? void 0 : logLevelToN[level],
      }) || 'true';
      cpSpawnOptions.env = {
        // Merge with previous options or the current environment.
        ...(cpSpawnOptions.env ?? process.env),
        FFREPORT,
      };
    }

    const cp = spawnChildProcess(ffmpegPath, args, cpSpawnOptions);

    const onExit = () => {
      const closeSocketServer = (server: Server) => {
        if (server.listening) server.close();
      };
      // Close all socket servers, this is necessary for proper cleanup after
      // failed conversions, or otherwise errored ffmpeg processes.
      inputSocketServers.forEach(closeSocketServer);
      outputSocketServers.forEach(closeSocketServer);
      // Remove listeners after cleanup.
      cp.off('exit', onExit);
      cp.off('error', onExit);
    };
    cp.on('exit', onExit);
    cp.on('error', onExit);

    const ffmpeg = new Process(cp, args, ffmpegPath);

    if (logger) {
      const stderr = readlines(cp.stderr);
      const onLine = (line: string) => {
        const match = line.match(LEVEL_REGEX);
        if (match !== null) {
          const level = match[1] as keyof FFmpegLogger;
          logger[level]?.(line);
        }
      };
      stderr.on('line', onLine);
    }

    return ffmpeg;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    const inputs = this.#inputs;
    if (inputs.length < 1)
      throw new TypeError('At least one input file should be specified');
    const outputs = this.#outputs;
    if (outputs.length < 1)
      throw new TypeError('At least one output file should be specified');
    return [
      ...this.#args,
      ...flatMap(inputs, (input) => input.getArgs()),
      ...flatMap(outputs, (output) => output.getArgs()),
    ];
  }
}

class Input implements FFmpegInput {
  constructor(url: string, public readonly isStream: boolean, stream?: NodeJS.ReadableStream) {
    this.#url = url;
    this.#stream = stream;
  }
  #url: string;
  #args: string[] = [];
  #stream?: NodeJS.ReadableStream;

  offset(offset: number): this {
    return this.args('-itsoffset', `${offset}ms`);
  }
  duration(duration: number): this {
    return this.args('-t', `${duration}ms`);
  }
  start(start: number): this {
    return this.args('-ss', `${start}ms`);
  }
  format(format: string): this {
    return this.args('-f', format);
  }
  codec(codec: string): this {
    return this.args('-c', codec);
  }
  videoCodec(codec: string): this {
    return this.args('-c:V', codec);
  }
  audioCodec(codec: string): this {
    return this.args('-c:a', codec);
  }
  subtitleCodec(codec: string): this {
    return this.args('-c:s', codec);
  }
  async probe(options: ProbeOptions = {}): Promise<ProbeResult> {
    const readChunk = (): Promise<Uint8Array> => {
      const stream = this.#stream!;
      // Follow FFmpeg's default probe size of 5MB when `probeSize` is not given.
      const size = options.probeSize ?? 5000000;
      return new Promise<Uint8Array>((resolve, reject) => {
        const unlisten = () => {
          stream.off('readable', onReadable);
          stream.off('error', onError);
        };
        const onError = (error: Error) => {
          unlisten();
          reject(error);
        };
        const onReadable = () => {
          const chunk = stream.read(size) as Uint8Array;
          if (chunk !== null) {
            unlisten();
            // Put the chunk read back into the stream so that it won't be consumed.
            stream.unshift(chunk);
            resolve(chunk);
          }
        };
        stream.on('readable', onReadable);
        stream.on('error', onError);
        stream.pause();
      });
    };

    const source = this.isStream ? await readChunk() : this.#url;
    return await probe(source, options);
  }
  getArgs(): string[] {
    return [
      ...this.#args,
      '-i',
      this.#url,
    ];
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
}

class Output implements FFmpegOutput {
  constructor(url: string, public readonly isStream: boolean) {
    this.#url = url;
  }
  #url: string;
  #args: string[] = [];
  #videoFilters: string[] = [];
  #audioFilters: string[] = [];

  videoFilter(filter: string, options?: Record<string, any> | any[]) {
    this.#videoFilters.push(stringifyFilterDescription(filter, options));
    return this;
  }
  audioFilter(filter: string, options?: Record<string, any> | any[]) {
    this.#audioFilters.push(stringifyFilterDescription(filter, options));
    return this;
  }
  metadata(metadata: Record<string, string | undefined | null>, specifier?: string): this {
    return this.args(...flatMap(Object.entries(metadata), ([key, value]) => [
      `-metadata${specifier ? ':' + specifier : ''}`,
      `${key}=${value === '' || isNullish(value) ? '' : stringifyValue(value)}`,
    ]));
  }
  map(...streams: string[]): this {
    return this.args(...flatMap(streams, (stream) => ['-map', stream]));
  }
  format(format: string): this {
    return this.args('-f', format);
  }
  codec(codec: string): this {
    return this.args('-c', codec);
  }
  videoCodec(codec: string): this {
    return this.args('-c:V', codec);
  }
  audioCodec(codec: string): this {
    return this.args('-c:a', codec);
  }
  subtitleCodec(codec: string): this {
    return this.args('-c:s', codec);
  }
  duration(duration: number): this {
    return this.args('-t', `${duration}ms`);
  }
  start(start: number): this {
    return this.args('-ss', `${start}ms`);
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    const videoFilters = this.#videoFilters;
    const audioFilters = this.#audioFilters;
    return [
      ...this.#args,
      ...(videoFilters.length > 0
        ? ['-filter:V', videoFilters.map(escapeFilterDescription).join(',')] : []),
      ...(audioFilters.length > 0
        ? ['-filter:a', audioFilters.map(escapeFilterDescription).join(',')] : []),
      this.#url,
    ];
  }
}

function handleInputSource(source: InputSource, streams: [string, NodeJS.ReadableStream][]): [string, boolean, NodeJS.ReadableStream?] {
  if (typeof source === 'string') {
    return [source, false];
  } else {
    const path = getSocketPath();
    const stream = toReadableStream(source);
    streams.push([path, stream]);
    return [getSocketURL(path), true, stream];
  }
}

async function handleOutputStreams(outputStreams: [string, NodeJS.WritableStream[]][]) {
  const servers = await Promise.all(outputStreams.map(([path]) => createSocketServer(path)));
  outputStreams.forEach(([, streams], i) => handleOutputStream(servers[i], streams));
  return servers;
}

async function handleInputStreams(inputStreams: [string, NodeJS.ReadableStream][]) {
  const servers = await Promise.all(inputStreams.map(([path]) => createSocketServer(path)));
  inputStreams.forEach(([, stream], i) => handleInputStream(servers[i], stream));
  return servers;
}

function handleInputStream(server: Server, stream: NodeJS.ReadableStream) {
  server.once('connection', (socket) => {
    const unlisten = () => {
      socket.off('error', onError);
      stream.off('error', onError);
      stream.off('end', unlisten);
    };
    // TODO: errors are ignored, this is potentially inconsistent with
    // the current behavior of output streams, where any error will be
    // either caught by the user or terminate the Node.js process with
    // an uncaught exception message.
    const onError = () => {
      // Close the socket connection on error, this reduces the risk of
      // ffmpeg waiting for further chunks that will never be emitted
      // by an errored stream.
      if (socket.writable) socket.end();
      unlisten();
    };
    socket.on('error', onError);
    stream.on('error', onError);
    stream.on('end', unlisten);
    stream.pipe(socket);

    // Do NOT accept further connections, close() will close the server after
    // all existing connections are ended.
    server.close();
  });
}

function handleOutputStream(server: Server, streams: NodeJS.WritableStream[]) {
  server.once('connection', (socket) => {
    const unlisten = () => {
      socket.off('error', onError);
      socket.off('data', onData);
      socket.off('end', onEnd);
    };
    // TODO: improve error handling
    const onError = () => {
      if (socket.writable) socket.end();
      unlisten();
    };
    // TODO: errors in output streams will fall through, so we just rely
    // on the user to add an error listener to their output streams.
    // Could this be different from the behavior one might expect?
    const onData = (data: Uint8Array) => {
      streams.forEach((stream) => stream.write(data));
    };
    const onEnd = () => {
      streams.forEach((stream) => stream.end());
      unlisten();
    };
    socket.on('error', onError);
    socket.on('data', onData);
    socket.on('end', onEnd);

    // Do NOT accept further connections, close() will close the server after
    // all existing connections are ended.
    server.close();
  });
}
