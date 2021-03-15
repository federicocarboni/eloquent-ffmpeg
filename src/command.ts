import type {
  ConcatOptions,
  ConcatSource,
  FFmpegCommand,
  FFmpegInput,
  FFmpegLogger,
  FFmpegOptions,
  FFmpegOutput,
  FFmpegProcess,
  InputSource,
  OutputDestination,
  ProbeOptions,
  ProbeResult,
  SpawnOptions
} from './types';

import * as childProcess from 'child_process';
import * as readline from 'readline';
import { pipeline } from 'stream';

import {
  DEV_NULL,
  flatMap,
  isInputSource,
  isNullish,
  isWritableStream,
  read,
  toReadableStream
} from './utils';
import {
  escapeConcatFile,
  escapeTeeComponent,
  stringifyFilterDescription,
  stringifyObjectColonSeparated,
  stringifyValue
} from './string';
import { startSocketServer, getSocketPath, getSocketURL } from './sock';
import { Process } from './process';
import { probe } from './probe';

/**
 * Create a new FFmpegCommand.
 * @param options -
 * @public
 */
export function ffmpeg(options: FFmpegOptions = {}): FFmpegCommand {
  return new Command(options);
}

// Match the `[level]` segment inside an ffmpeg line.
const LEVEL_REGEX = /\[(trace|debug|verbose|info|warning|error|fatal)\]/;

// Turn an ffmpeg log level into its numeric representation.
const logLevelToN = Object.assign(Object.create(null) as {}, {
  quiet: -8,
  panic: 0,
  fatal: 8,
  error: 16,
  warning: 24,
  info: 32,
  verbose: 40,
  debug: 48,
  trace: 56,
});

class Command implements FFmpegCommand {
  constructor(options: FFmpegOptions) {
    const { level, progress = true, overwrite = true } = options;
    this.args(overwrite ? '-y' : '-n');
    if (progress)
      this.args('-progress', 'pipe:1');
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
    const { safe = false, protocols, useDataURI = false } = options;
    const inputStreams = this.#inputStreams;

    // Dynamically create an ffconcat file with the given directives.
    // https://ffmpeg.org/ffmpeg-all.html#concat-1
    const directives = ['ffconcat version 1.0'];
    const addFile = (source: InputSource) => {
      const [url] = handleInputSource(source, inputStreams);
      directives.push(`file ${escapeConcatFile(url)}`);
    };
    for (const source of sources) {
      if (isInputSource(source)) {
        addFile(source);
      } else {
        const { file, duration, inpoint, outpoint } = source;
        addFile(file);
        if (duration !== void 0)
          directives.push(`duration ${duration}ms`);
        if (inpoint !== void 0)
          directives.push(`inpoint ${inpoint}ms`);
        if (outpoint !== void 0)
          directives.push(`outpoint ${outpoint}ms`);
        // TODO: add support for the directives file_packet_metadata, stream and exact_stream_id
      }
    }
    // Create the ffconcat script as a buffer.
    const ffconcat = Buffer.from(directives.join('\n'), 'utf8');

    const source = useDataURI
      // FFmpeg only supports base64-encoded data urls.
      ? `data:text/plain;base64,${ffconcat.toString('base64')}`
      : ffconcat;

    const input = this.input(source);

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

    return input;
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    const urls: string[] = [];
    let isStream = false;
    let streams: NodeJS.WritableStream[];

    for (const dest of destinations) {
      if (typeof dest === 'string') {
        urls.push(dest);
      } else {
        if (!isWritableStream(dest))
          throw new TypeError(`${dest} is not a writable stream`);
        if (isStream) {
          streams!.push(dest);
        } else {
          // When the output has to be written to multiple streams, we
          // we only use one unix socket / windows pipe by writing the
          // same output to multiple streams internally.
          isStream = true;
          streams = [dest];
          const path = getSocketPath();
          urls.push(getSocketURL(path));
          this.#outputStreams.push([path, streams]);
        }
      }
    }

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
    const { ffmpegPath = 'ffmpeg', spawnOptions, report = false, logger = false } = options;
    const args = this.getArgs();

    // Start all socket servers needed to handle the streams.
    const ioSocketServers = await Promise.all([
      ...this.#inputStreams.map(async ([path, stream]) => {
        const server = await startSocketServer(path);
        server.once('connection', (socket) => {
          pipeline(stream, socket, () => {
            // Close the socket connection if still writable, this reduces the risk
            // of ffmpeg waiting for further chunks that will never be emitted by
            // an errored stream.
            if (socket.writable) socket.end();
          });

          // Do NOT accept further connections, close() will close the server after
          // all existing connections are ended.
          server.close();
        });
        return server;
      }),
      ...this.#outputStreams.map(async ([path, streams]) => {
        const server = await startSocketServer(path);
        server.once('connection', (socket) => {
          socket.on('error', () => {
            // TODO: improve error handling
            if (socket.writable) socket.end();
          });
          socket.on('data', (data) => {
            // TODO: errors in output streams will fall through, so we just rely
            // on the user to add an error listener to their output streams.
            // Could this be different from the behavior one might expect?
            for (const stream of streams) if (stream.writable) stream.write(data);
          });
          socket.on('end', () => {
            for (const stream of streams) if (stream.writable) stream.end();
          });

          // Do NOT accept further connections, close() will close the server after
          // all existing connections are ended.
          server.close();
        });
        return server;
      }),
    ]);

    const cpSpawnOptions: childProcess.SpawnOptions = {
      stdio: ['pipe', 'pipe', logger ? 'pipe' : 'ignore'],
      ...spawnOptions,
    };

    if (report) {
      // FFREPORT can be either a ':' separated key-value pair which takes `file` and `level` as
      // options or any non-empty string which enables reporting with default options.
      // If no options are specified the string `true` is used.
      // https://ffmpeg.org/ffmpeg-all.html#Generic-options
      const FFREPORT = report !== true && stringifyObjectColonSeparated({
        file: report.file,
        level: logLevelToN[report.level!],
      }) || 'true';
      cpSpawnOptions.env = {
        // Merge with previous options or the current environment.
        ...(cpSpawnOptions.env ?? process.env),
        FFREPORT,
      };
    }

    const cp = childProcess.spawn(ffmpegPath, args, cpSpawnOptions);

    const onExit = () => {
      cp.off('exit', onExit);
      cp.off('error', onExit);
      // Close all socket servers, this is necessary for proper cleanup after
      // failed conversions, or otherwise errored ffmpeg processes.
      for (const server of ioSocketServers) {
        if (server.listening) server.close();
      }
    };
    cp.on('exit', onExit);
    cp.on('error', onExit);

    if (logger) {
      const stderr = readline.createInterface(cp.stderr!);
      const onLine = (line: string) => {
        const match = line.match(LEVEL_REGEX);
        if (match !== null) {
          const level = match[1] as keyof FFmpegLogger;
          logger[level]?.(line);
        }
      };
      stderr.on('line', onLine);
    }

    return new Process(cp, ffmpegPath, args);
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    return [
      ...this.#args,
      ...flatMap(this.#inputs, (input) => input.getArgs()),
      ...flatMap(this.#outputs, (output) => output.getArgs()),
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
    const { probeSize } = options;
    if (probeSize !== void 0 && (!Number.isInteger(probeSize) || probeSize < 32))
      throw new TypeError(`Cannot probe ${probeSize} bytes, probeSize must be an integer >= 32`);

    let source: Uint8Array | string;
    if (this.isStream) {
      const stream = this.#stream!;
      source = await read(stream, probeSize ?? 5000000);
      stream.unshift(source);
    } else {
      source = this.#url;
    }

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

  videoFilter(filter: string, options: Record<string, unknown> | unknown[] | undefined = void 0) {
    this.#videoFilters.push(stringifyFilterDescription(filter, options));
    return this;
  }
  audioFilter(filter: string, options: Record<string, unknown> | unknown[] | undefined = void 0) {
    this.#audioFilters.push(stringifyFilterDescription(filter, options));
    return this;
  }
  metadata(metadata: Record<string, unknown>, stream: string | undefined = void 0): this {
    return this.args(...flatMap(Object.entries(metadata), ([key, value]) => [
      `-metadata${stream ? `:${stream}` : ''}`,
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
      ...(videoFilters.length > 0 ? ['-filter:V', videoFilters.join(',')] : []),
      ...(audioFilters.length > 0 ? ['-filter:a', audioFilters.join(',')] : []),
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
