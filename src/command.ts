import {
  ChildProcessWithoutNullStreams,
  spawn as spawnChildProcess,
  SpawnOptions as ChildProcessOptions
} from 'child_process';
import { Readable } from 'stream';
import { Server } from 'net';
import { createSocketServer, getSocketPath, getSocketUrl } from './sock';
import { DEV_NULL, flatMap, isReadableStream, toReadable } from './utils';
import {
  AudioCodec, AudioDecoder, AudioEncoder, AudioFilter, Demuxer, Format,
  Muxer,
  SubtitleCodec, SubtitleDecoder, SubtitleEncoder, VideoCodec,
  VideoDecoder, VideoEncoder, VideoFilter
} from './_types';
import { probe, ProbeOptions, ProbeResult } from './probe';
import { stringifySimpleFilterGraph } from './filters';
import { FFmpegProcess, Process } from './process';
import { getFFmpegPath } from './env';
import { escapeConcatFile, escapeTeeComponent } from './string';

/**
 * **UNSTABLE**: Support for logging is under consideration, this is not useful enough to recommend
 * its usage.
 *
 * @alpha
 */
export enum LogLevel {
  Quiet = 'quiet',
  Panic = 'panic',
  Fatal = 'fatal',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Verbose = 'verbose',
  Debug = 'debug',
  Trace = 'trace',
}

/** @public */
export type InputSource = string | Uint8Array | AsyncIterable<Uint8Array>;
/** @public */
export type OutputDestination = string | NodeJS.WritableStream;
/** @alpha */
export type ConcatSource = InputSource
  | {
    file?: InputSource;
    duration?: number;
    inpoint?: number;
    outpoint?: number;
  };

/** @public */
export interface FFmpegCommand {
  /**
   * **UNSTABLE**: Under consideration for removal.
   *
   * The log level that will be used for the command. Set it using {@link FFmpegOptions}.
   * @alpha
   */
  readonly logLevel: LogLevel;
  /**
   * Adds an input to the conversion.
   * @param source -
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.input('input.avi');
   * cmd.input(fs.createReadStream('input2.avi'));
   * cmd.output();
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
   */
  input(source: InputSource): FFmpegInput;
  /**
   * **UNSTABLE:** New API, see https://github.com/FedericoCarboni/eloquent-ffmpeg/issues/2
   *
   * Concatenate media files using the `concat` demuxer.
   *
   * @param sources - The input sources to be concatenated, they can be in different formats but
   * they must have the same streams, codecs, timebases, etc...
   * {@link https://ffmpeg.org/ffmpeg-formats.html#concat-1}
   * {@link https://trac.ffmpeg.org/wiki/Concatenate}
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.concat(['chunk1.webm', 'chunk2.webm']);
   * cmd.output('complete_video.webm');
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
   * @alpha
   */
  concat(sources: ConcatSource[], options?: ConcatOptions): FFmpegInput;
  /**
   * Adds an output to the conversion, multiple destinations are supported using
   * the `tee` protocol. You can use mixed destinations and multiple streams.
   * Both NodeJS WritableStreams and AsyncGenerators are fully supported.
   * @param destinations - A sequence of OutputDestinations to which the output
   * will be written. If no destinations are specified the conversion will run,
   * but any output data will be ignored.
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.input('input.avi');
   * cmd.output(fs.createWriteStream('dest1.mkv'), 'dest2.mkv');
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
   */
  output(...destinations: OutputDestination[]): FFmpegOutput;
  /**
   * Add arguments, they will be placed before any input or output arguments.
   * @param args -
   */
  args(...args: string[]): this;
  /**
   * Starts the conversion, this method is asynchronous so it must be `await`'ed.
   * @param ffmpegPath - Path to the ffmpeg executable. Defaults to `getFFmpegPath()`.
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.input('input.avi');
   * cmd.output('output.mp4');
   * const process = await cmd.spawn();
   * ```
   */
  spawn(options?: SpawnOptions): Promise<FFmpegProcess>;
  /**
   * Returns all the arguments with which ffmpeg will be spawned.
   */
  getArgs(): string[];
}

/** @alpha */
export interface ConcatOptions {
  safe?: boolean;
  protocols?: string[];
  // TODO: add support for using an intermediate file
}

/** @public */
export interface SpawnOptions {
  /**
   * Path to the FFmpeg executable.
   */
  ffmpegPath?: string;
  /**
   * Add custom options that will be used to spawn the process.
   * {@link https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_spawn_command_args_options}
   */
  spawnOptions?: ChildProcessOptions;
}

/** @public */
export interface FFmpegOptions {
  /**
   * **UNSTABLE**: Support for logging is under consideration.
   *
   * Change FFmpeg's LogLevel, defaults to `LogLevel.Error`.
   * @alpha
   */
  logLevel?: LogLevel;
  /**
   * Enable piping the conversion progress, if set to `false` {@link FFmpegProcess.progress}
   * will silently fail. Defaults to `true`.
   */
  progress?: boolean;
  /**
   * Whether to overwrite the output destinations if they already exist. Required
   * to be `true` for streaming outputs. Defaults to `true`.
   */
  overwrite?: boolean;
}

/** @public */
export interface Progress {
  frames: number;
  fps: number;
  bitrate: number;
  bytes: number;
  time: number;
  framesDuped: number;
  framesDropped: number;
  speed: number;
}

/** @public */
export interface FFmpegInput {
  /**
   * **UNSTABLE**: Breaking changes are being considered, implementation details can change without
   * notice.
   *
   * Get information about the input, this is especially helpful when working
   * with streams. If the source is a stream `options.probeSize` number of bytes
   * will be read and passed to ffprobe; those bytes will be kept in memory
   * until the input is used in conversion.
   *
   * **Note:** This is not recommended for `concat()` inputs, because it may not
   * have effect you may expect. When using `concat()` inputs with streams, the
   * streams will be consumed.
   *
   * @param options -
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.output('output.mp4');
   * const input = cmd.input(fs.createReadStream('input.mkv'));
   * const info = await input.probe();
   * console.log(`Video duration: ${info.duration}, format: ${info.format}`);
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
   * @alpha
   */
  probe(options?: ProbeOptions): Promise<ProbeResult>;
  /**
   * Add input arguments, they will be placed before any additional arguments.
   * @param args -
   */
  args(...args: string[]): this;
  /**
   * Select the input format.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param format -
   */
  format(format: Format | Demuxer | (string & {})): this;
  /**
   * Select the codec for all streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  codec(codec: VideoCodec | VideoDecoder | AudioCodec | AudioDecoder | SubtitleCodec | SubtitleDecoder | (string & {})): this;
  /**
   * Select the codec for video streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  videoCodec(codec: VideoCodec | VideoDecoder | (string & {})): this;
  /**
   * Select the codec for audio streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  audioCodec(codec: AudioCodec | AudioDecoder | (string & {})): this;
  /**
   * Select the codec for subtitle streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  subtitleCodec(codec: SubtitleCodec | SubtitleDecoder | (string & {})): this;
  /**
   * Limit the duration of the data read from the input.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param duration - The limit for the duration in milliseconds.
   */
  duration(duration: number): this;
  /**
   * Seeks in the input file to `start`.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param start - The position to seek to in milliseconds.
   */
  start(start: number): this;
  /**
   * Adds `offset` to the input timestamps.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param offset - The offset in milliseconds. MAY be negative.
   */
  offset(offset: number): this;
  /**
   * Returns all the arguments for the input.
   */
  getArgs(): string[];
  /**
   * Whether the input is using streams.
   */
  readonly isStream: boolean;
}

/** @public */
export interface FFmpegOutput {
  /**
   * Add output arguments, they will be placed before any additional arguments.
   * @param args -
   */
  args(...args: string[]): this;
  /**
   * Select the output format.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param format -
   */
  format(format: Format | Muxer | (string & {})): this;
  /**
   * Select the codec for all streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  codec(codec: VideoCodec | VideoEncoder | AudioCodec | AudioEncoder | SubtitleCodec | SubtitleEncoder | (string & {})): this;
  /**
   * Select the codec for video streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  videoCodec(codec: VideoCodec | VideoEncoder | (string & {})): this;
  /**
   * Select the codec for audio streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  audioCodec(codec: AudioCodec | AudioEncoder | (string & {})): this;
  /**
   * Select the codec for subtitle streams.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param codec -
   */
  subtitleCodec(codec: SubtitleCodec | SubtitleEncoder | (string & {})): this;
  /**
   * **UNSTABLE**
   *
   * Applies a filter to the video streams.
   * @param filter - The filter to apply.
   * @param options - Additional configuration for the filter.
   */
  videoFilter(filter: VideoFilter | (string & {}), options?: Record<string, any> | any[]): this;
  /**
   * **UNSTABLE**
   *
   * Applies a filter to the video streams.
   * @param filter - The filter to apply.
   * @param options - Additional configuration for the filter.
   */
  audioFilter(filter: AudioFilter | (string & {}), options?: Record<string, any> | any[]): this;
  /**
   * Limit the duration of the data written to the output.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param duration - The limit for the duration in milliseconds.
   */
  duration(duration: number): this;
  /**
   * Decodes but discards the input until `start` is reached.
   * See {@link https://ffmpeg.org/ffmpeg-all.html#Main-options}
   * @param start - The number of milliseconds to discard.
   */
  start(start: number): this;
  /**
   * Maps inputs' streams to output streams. This is an advanced option.
   * {@link https://ffmpeg.org/ffmpeg-all.html#Advanced-options}
   * {@link https://ffmpeg.org/ffmpeg-all.html#Stream-specifiers-1}
   * {@link https://ffmpeg.org/ffmpeg-all.html#Automatic-stream-selection}
   * @param stream - The stream specifier.
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.input('input0.mkv');
   * cmd.input('input1.avi');
   * cmd.output('output0.webm')
   * // Takes input0's video streams and input1's audio streams.
   *   .map('0:v', '1:a');
   * cmd.output('output1.webm')
   * // Streams will be mapped in the order they were specified
   * // here output1's first stream will be input0's second stream
   * // and its second stream will be input1's first stream.
   *   .map('0:1', '1:0');
   * ```
   */
  map(...streams: string[]): this;
  /**
   * Add metadata to a stream or an output.
   * {@link https://ffmpeg.org/ffmpeg.html#Main-options}
   * @param metadata - The metadata to add to the stream.
   * @param specifier - The stream to add metadata to, if not given `metadata`
   * will be added to the output file.
   */
  metadata(metadata: Record<string, string>, specifier?: string): this;
  /**
   * Returns all the arguments for the output.
   */
  getArgs(): string[];
  /**
   * Whether the output is using streams.
   */
  readonly isStream: boolean;
}

/**
 * Create a new FFmpegCommand.
 * @param options -
 * @public
 */
export function ffmpeg(options?: FFmpegOptions): FFmpegCommand {
  return new Command(options);
}

class Command implements FFmpegCommand {
  constructor(options: FFmpegOptions = {}) {
    this.logLevel = options.logLevel ?? LogLevel.Error;
    this.#args.push(options.overwrite !== false ? '-y' : '-n');
    if (options.progress !== false)
      this.#args.push('-progress', 'pipe:1', '-nostats');
  }
  #args: string[] = [];
  #inputs: Input[] = [];
  #outputs: Output[] = [];
  #inputStreams: [string, NodeJS.ReadableStream][] = [];
  #outputStreams: [string, NodeJS.WritableStream[]][] = [];

  logLevel: LogLevel;
  input(source: InputSource): FFmpegInput {
    const [url, isStream, stream] = handleSource(source, this.#inputStreams);
    const input = new Input(url, isStream, stream);
    this.#inputs.push(input);
    return input;
  }
  concat(sources: ConcatSource[], options?: ConcatOptions) {
    // Dynamically create an ffconcat file with the given directives.
    // https://ffmpeg.org/ffmpeg-all.html#toc-concat-1
    let directives = 'ffconcat version 1.0\n';
    const isInputSource = (o: any): o is InputSource => (
      typeof o === 'string' || isReadableStream(o) ||
      o instanceof Uint8Array || Symbol.asyncIterator in o
    );
    const inputStreams = this.#inputStreams;
    const addFile = (file: InputSource) => {
      const [url] = handleSource(file, inputStreams);
      directives += `file ${escapeConcatFile(url)}\n`;
    };
    sources.forEach((source) => {
      if (isInputSource(source)) {
        addFile(source);
      } else {
        if (source.file !== void 0)
          addFile(source.file);
        if (source.duration !== void 0)
          directives += `duration ${source.duration}ms\n`;
        if (source.inpoint !== void 0)
          directives += `inpoint ${source.inpoint}ms\n`;
        if (source.outpoint !== void 0)
          directives += `outpoint ${source.outpoint}ms\n`;
        // TODO: add support for the directives file_packet_metadata, stream and exact_stream_id
      }
    });

    const stream = Readable.from([Buffer.from(directives, 'utf8')], { objectMode: false });
    const path = getSocketPath();
    inputStreams.push([path, stream]);
    const input = new Input(getSocketUrl(path), true, stream);

    // Add extra arguments to the input based on the given options
    // the option safe is NOT enabled by default because it doesn't
    // allow streams or protocols other than the currently used one,
    // which, depending on the platform, may be `file` (on Windows)
    // or `unix` (on every other platform).
    input.args('-safe', options?.safe ? '1' : '0');
    // Protocol whitelist enables certain protocols in the ffconcat
    // file dynamically created by this method.
    if (options?.protocols && options.protocols.length > 0)
      input.args('-protocol_whitelist', options.protocols.join(','));

    this.#inputs.push(input);
    return input;
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    let streams: NodeJS.WritableStream[];
    let isStream = false;
    const urls = flatMap(destinations, (dest) => {
      if (typeof dest === 'string') {
        return dest;
      }
      // When the output has to be written to multiple streams, we
      // we only use one unix socket / windows pipe by writing the
      // same output to multiple streams internally.
      if (!isStream) {
        isStream = true;
        streams = [dest];
        const path = getSocketPath();
        this.#outputStreams.push([path, streams]);
        return getSocketUrl(path);
      }
      // `streams` has been already added to `#outputStreams` here
      // we push the new stream and return an empty array to avoid
      // duplicating the unix socket / windows pipe path.
      streams.push(dest);
      return [];
    });
    // - If there are no urls the output will be disarded by
    //   using `/dev/null` or `NUL` as the destination.
    // - If there is only one url it will be given directly
    //   as the output url to ffmpeg.
    // - If there are more than one urls the `tee` protocol
    //   will be used.
    const url = urls.length === 0 ? DEV_NULL
      : urls.length === 1 ? urls[0]
      : `tee:${urls.map(escapeTeeComponent).join('|')}`;
    const output = new Output(url, isStream);
    this.#outputs.push(output);
    return output;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  async spawn(options: SpawnOptions = {}): Promise<FFmpegProcess> {
    const {
      ffmpegPath = getFFmpegPath(),
      spawnOptions = {},
    } = options;
    const args = this.getArgs();
    // Starts all socket servers needed to handle the streams.
    const [inputSocketServers, outputSocketServers] = await Promise.all([
      handleInputs(this.#inputStreams),
      handleOutputs(this.#outputStreams),
    ]);
    const ffmpeg = spawnChildProcess(ffmpegPath, args, {
      stdio: 'pipe',
      ...spawnOptions,
    }) as ChildProcessWithoutNullStreams;
    const onExit = (): void => {
      const closeSocketServer = (server: Server): void => {
        if (server.listening) server.close();
      };
      // Close all socket servers, this is necessary for proper cleanup after
      // failed conversions, or otherwise errored ffmpeg processes.
      inputSocketServers.forEach(closeSocketServer);
      outputSocketServers.forEach(closeSocketServer);
      // Remove listeners after cleanup.
      ffmpeg.off('exit', onExit);
      ffmpeg.off('error', onExit);
    };
    ffmpeg.on('exit', onExit);
    ffmpeg.on('error', onExit);
    return new Process(ffmpeg, args, ffmpegPath);
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
      '-v', this.logLevel.toString(),
      ...flatMap(inputs, (input) => input.getArgs()),
      ...flatMap(outputs, (output) => output.getArgs()),
    ];
  }
}

class Input implements FFmpegInput {
  constructor(url: string, isStream: boolean, stream?: NodeJS.ReadableStream) {
    this.#url = url;
    this.#stream = stream;
    this.isStream = isStream;
  }
  #url: string;
  #args: string[] = [];
  #stream?: NodeJS.ReadableStream;
  isStream: boolean;
  offset(offset: number): this {
    return this.args('-itsoffset', `${offset}ms`);
  }
  duration(duration: number): this {
    return this.args('-t', `${duration}ms`);
  }
  start(start: number): this {
    return this.args('-ss', `${start}ms`);
  }
  format(format: Format | Demuxer): this {
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
      const size = options.probeSize ?? 5000000;
      return new Promise<Uint8Array>((resolve, reject) => {
        const unlisten = (): void => {
          stream.off('readable', onReadable);
          stream.off('error', onError);
        };
        const onError = (error: Error): void => {
          unlisten();
          reject(error);
        };
        const onReadable = (): void => {
          const chunk = stream.read(size) as Uint8Array;
          if (chunk !== null) {
            unlisten();
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
  constructor(url: string, isStream: boolean) {
    this.#url = url;
    this.isStream = isStream;
  }
  #url: string;
  #args: string[] = [];
  #videoFilters: string[] = [];
  #audioFilters: string[] = [];
  isStream: boolean;
  videoFilter(filter: string, options?: Record<string, any> | any[]) {
    this.#videoFilters.push(stringifySimpleFilterGraph(filter, options));
    return this;
  }
  audioFilter(filter: string, options?: Record<string, any> | any[]) {
    this.#audioFilters.push(stringifySimpleFilterGraph(filter, options));
    return this;
  }
  metadata(metadata: Record<string, string>, specifier?: string): this {
    return this.args(...flatMap(Object.entries(metadata), ([key, value]) => [
      `-metadata${specifier ? ':' + specifier : ''}`,
      `${key}=${value}`,
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

function handleSource(source: InputSource, streams: [string, NodeJS.ReadableStream][]): [string, boolean, NodeJS.ReadableStream?] {
  if (typeof source === 'string') {
    return [source, false];
  } else {
    const path = getSocketPath();
    const stream = toReadable(source);
    streams.push([path, stream]);
    return [getSocketUrl(path), true, stream];
  }
}

function handleInputStream(server: Server, stream: NodeJS.ReadableStream) {
  server.once('connection', (socket) => {
    // TODO: errors are ignored, this is potentially inconsistent with
    // the current behavior of output streams, where any/ error will be
    // either caught by the user or terminate the Node.js process with
    // an uncaught exception message.
    const onError = (): void => {
      // Close the socket connection on error, this reduces the risk of
      // ffmpeg waiting for further chunks that will never be emitted
      // by an errored stream.
      if (socket.writable) socket.end();
      stream.off('error', onError);
      socket.off('error', onError);
    };
    stream.on('error', onError);
    socket.on('error', onError);
    stream.pipe(socket);

    // Do NOT accept further connections, close() will close the server after
    // all existing connections are ended.
    server.close();
  });
}
function handleOutputStream(server: Server, streams: NodeJS.WritableStream[]) {
  server.once('connection', (socket) => {
    const unlisten = (): void => {
      socket.off('error', onError);
      socket.off('data', onData);
      socket.off('end', onEnd);
    };
    // TODO: improve error handling
    const onError = (): void => {
      if (socket.writable) socket.end();
      unlisten();
    };
    // TODO: errors in output streams will fall through, so we just rely
    // on the user to add an error listener to their output streams.
    // Could this be different from the behavior one might expect?
    const onData = (data: Uint8Array): void => {
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

async function handleOutputs(outputStreams: [string, NodeJS.WritableStream[]][]) {
  const servers = await Promise.all(outputStreams.map(([path]) => createSocketServer(path)));
  outputStreams.forEach(([, streams], i) => handleOutputStream(servers[i], streams));
  return servers;
}
async function handleInputs(inputStreams: [string, NodeJS.ReadableStream][]) {
  const servers = await Promise.all(inputStreams.map(([path]) => createSocketServer(path)));
  inputStreams.forEach(([, stream], i) => handleInputStream(servers[i], stream));
  return servers;
}
