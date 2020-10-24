import { spawn as spawnProcess } from 'child_process';
import { Readable } from 'stream';
import { Server } from 'net';
import { createSocketServer, getSocketPath, getSocketResource } from './sock';
import { IGNORED_ERRORS, isNullish } from './utils';
import {
  AudioCodec, AudioDecoder, AudioEncoder, AudioFilter, Demuxer, Format,
  Muxer,
  SubtitleCodec, SubtitleDecoder, SubtitleEncoder, VideoCodec,
  VideoDecoder, VideoEncoder, VideoFilter
} from './_types';
import { probe, ProbeOptions, ProbeResult } from './probe';
import { getFFmpegPath } from './env';
import { stringifySimpleFilterGraph } from './filters';
import { FFmpegProcess, Process } from './process';

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
  spawn(ffmpegPath?: string): Promise<FFmpegProcess>;
  /**
   * Returns all the arguments with which ffmpeg will be spawned.
   */
  getArgs(): string[];
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
  #args: string[] = [];
  #inputs: Input[] = [];
  #outputs: Output[] = [];

  logLevel: LogLevel;
  constructor(options: FFmpegOptions = {}) {
    this.logLevel = options.logLevel ?? LogLevel.Error;
    this.#args.push(options.overwrite !== false ? '-y' : '-n');
    if (options.progress !== false)
      this.#args.push('-progress', 'pipe:1', '-nostats');
  }
  input(source: InputSource): FFmpegInput {
    const input = new Input(source);
    this.#inputs.push(input);
    return input;
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    const output = new Output(destinations);
    this.#outputs.push(output);
    return output;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  async spawn(ffmpegPath: string = getFFmpegPath()): Promise<FFmpegProcess> {
    const args = this.getArgs();
    const [inputSocketServers, outputSocketServers] = await Promise.all([
      handleInputs(this.#inputs),
      handleOutputs(this.#outputs)
    ]);
    const process = spawnProcess(ffmpegPath, args, { stdio: 'pipe' });
    const onExit = (): void => {
      const closeSocketServer = (server: Server): void => {
        if (server.listening) server.close();
      };
      // Close all socket servers, this is necessary for proper cleanup after
      // failed conversions, or otherwise errored ffmpeg processes.
      inputSocketServers.forEach(closeSocketServer);
      outputSocketServers.forEach(closeSocketServer);
      // Remove listeners after cleanup.
      process.off('exit', onExit);
      process.off('error', onError);
    };
    const onError = (): void => {
      if (!isNullish(process.exitCode)) onExit();
    };
    process.on('exit', onExit);
    process.on('error', onError);
    return new Process(process, args, ffmpegPath);
  }
  getArgs(): string[] {
    const inputs = this.#inputs;
    if (inputs.length === 0)
      throw new TypeError('At least one input file should be specified');
    const outputs = this.#outputs;
    if (outputs.length === 0)
      throw new TypeError('At least one output file should be specified');
    return [
      ...this.#args,
      '-v', this.logLevel.toString(),
      ...([] as string[]).concat(...this.#inputs.map(o => o.getArgs())),
      ...([] as string[]).concat(...this.#outputs.map(o => o.getArgs())),
    ];
  }
}

const inputPathMap = new WeakMap<Input, string>();
const inputStreamMap = new WeakMap<Input, NodeJS.ReadableStream>();
class Input implements FFmpegInput {
  #resource: string;
  #args: string[] = [];

  isStream: boolean;
  constructor(source: InputSource) {
    if (typeof source === 'string') {
      this.#resource = source;
      this.isStream = false;
    } else {
      const path = getSocketPath();
      const stream = 'readable' in source ? source : Readable.from(source instanceof Uint8Array ? [source] : source, {
        objectMode: false
      });
      inputPathMap.set(this, path);
      inputStreamMap.set(this, stream);
      this.#resource = getSocketResource(path);
      this.isStream = true;
    }
  }
  offset(offset: number): this {
    this.#args.push('-itsoffset', `${offset}ms`);
    return this;
  }
  duration(duration: number): this {
    this.#args.push('-t', `${duration}ms`);
    return this;
  }
  start(start: number): this {
    this.#args.push('-ss', `${start}ms`);
    return this;
  }
  format(format: Format | Demuxer): this {
    this.#args.push('-f', format);
    return this;
  }
  codec(codec: string): this {
    this.#args.push('-c', codec);
    return this;
  }
  videoCodec(codec: string): this {
    this.#args.push('-c:V', codec);
    return this;
  }
  audioCodec(codec: string): this {
    this.#args.push('-c:a', codec);
    return this;
  }
  subtitleCodec(codec: string): this {
    this.#args.push('-c:s', codec);
    return this;
  }
  async probe(options: ProbeOptions = {}): Promise<ProbeResult> {
    const readChunk = (): Promise<Uint8Array> => {
      const stream = inputStreamMap.get(this)!;
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

    const source = this.isStream ? await readChunk() : this.#resource;
    return await probe(source, options);
  }
  getArgs(): string[] {
    return [
      ...this.#args,
      '-i', this.#resource,
    ];
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
}

const outputPathMap = new WeakMap<Output, string>();
const outputStreamMap = new WeakMap<Output, NodeJS.WritableStream[]>();
class Output implements FFmpegOutput {
  #resource: string;
  #args: string[] = [];
  #videoFilters: string[] = [];
  #audioFilters: string[] = [];
  isStream: boolean;

  constructor(destinations: OutputDestination[]) {
    if (destinations.length === 0) {
      const path = getSocketPath();
      outputPathMap.set(this, path);
      outputStreamMap.set(this, []);
      this.#resource = getSocketResource(path);
      this.isStream = true;
    } else if (destinations.length === 1) {
      const dest = destinations[0];
      if (typeof dest === 'string') {
        this.#resource = dest;
        this.isStream = false;
      } else {
        const path = getSocketPath();
        outputPathMap.set(this, path);
        outputStreamMap.set(this, [dest]);
        this.#resource = getSocketResource(path);
        this.isStream = true;
      }
    } else {
      const resources: string[] = [];
      const streams = [];
      const path = getSocketPath();
      this.isStream = false;
      for (const dest of destinations) {
        if (typeof dest === 'string') {
          resources.push(dest.replace(/[[|\]]/g, (char) => `\\${char}`));
        } else {
          if (!this.isStream) {
            outputPathMap.set(this, path);
            outputStreamMap.set(this, streams);
            resources.push(getSocketResource(path));
            this.isStream = true;
          }
          streams.push(dest);
        }
      }
      this.#resource = resources.length > 1 ? `tee:${resources.join('|')}` : resources[0];
    }
  }
  videoFilter(filter: string, options?: Record<string, any> | any[]) {
    this.#videoFilters.push(stringifySimpleFilterGraph(filter, options));
    return this;
  }
  audioFilter(filter: string, options?: Record<string, any> | any[]) {
    this.#audioFilters.push(stringifySimpleFilterGraph(filter, options));
    return this;
  }
  metadata(metadata: Record<string, string>, specifier?: string): this {
    this.#args.push(...([] as string[]).concat(...Object.entries(metadata).map(([key, value]) => {
      return [`-metadata${specifier ? ':' + specifier : ''}`, `${key}=${value}`];
    })));
    return this;
  }
  map(...streams: string[]): this {
    this.#args.push(...([] as string[]).concat(...streams.map(
      (stream) => ['-map', stream]
    )));
    return this;
  }
  format(format: string): this {
    this.#args.push('-f', format);
    return this;
  }
  codec(codec: string): this {
    this.#args.push('-c', codec);
    return this;
  }
  videoCodec(codec: string): this {
    this.#args.push('-c:V', codec);
    return this;
  }
  audioCodec(codec: string): this {
    this.#args.push('-c:a', codec);
    return this;
  }
  subtitleCodec(codec: string): this {
    this.#args.push('-c:s', codec);
    return this;
  }
  duration(duration: number): this {
    this.#args.push('-t', `${duration}ms`);
    return this;
  }
  start(start: number): this {
    this.#args.push('-ss', `${start}ms`);
    return this;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    return [
      ...this.#args,
      ...(this.#videoFilters.length > 0 ? ['-filter:V', this.#videoFilters.join(',')] : []),
      ...(this.#audioFilters.length > 0 ? ['-filter:a', this.#audioFilters.join(',')] : []),
      this.#resource,
    ];
  }
}

function handleInputStream(server: Server, stream: NodeJS.ReadableStream) {
  server.once('connection', (socket) => {
    // TODO: improve error handling
    const onError = (): void => {
      if (socket.writable) socket.end();
      stream.off('error', onError);
      socket.off('error', onError);
    };
    stream.once('error', onError);
    socket.once('error', onError);
    stream.pipe(socket);

    // Do NOT accept further connections, close() will close the server after
    // all existing connections are ended.
    server.close();
  });
}
function handleOutputStream(server: Server, streams: NodeJS.WritableStream[]) {
  server.once('connection', (socket) => {
    // TODO: improve error handling
    const onError = (error: Error & { code: string }): void => {
      if (!IGNORED_ERRORS.has(error.code))
        socket.end();
    };
    socket.on('error', onError);

    const onData = (data: Uint8Array): void => {
      streams.forEach((stream) => stream.write(data));
    };

    socket.on('data', onData);

    socket.once('end', () => {
      streams.forEach((stream) => stream.end());
      socket.off('error', onError);
      socket.off('data', onData);
    });

    // Do NOT accept further connections, close() will close the server after
    // all existing connections are ended.
    server.close();
  });
}

async function handleOutputs(outputs: Output[]) {
  const outputStreams = outputs.filter((output) => output.isStream);
  const streams = outputStreams.map((output) => outputStreamMap.get(output)!);
  const servers = await Promise.all(outputStreams.map((output) => {
    const path = outputPathMap.get(output)!;
    return createSocketServer(path);
  }));
  streams.forEach((streams, i) => handleOutputStream(servers[i], streams));
  return servers;
}
async function handleInputs(inputs: Input[]) {
  const inputStreams = inputs.filter((input) => input.isStream);
  const streams = inputStreams.map((input) => inputStreamMap.get(input)!);
  const servers = await Promise.all(inputStreams.map((input) => {
    const path = inputPathMap.get(input)!;
    return createSocketServer(path);
  }));
  streams.forEach((stream, i) => handleInputStream(servers[i], stream));
  return servers;
}
