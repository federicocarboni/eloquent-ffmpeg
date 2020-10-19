import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn as spawnProcess
} from 'child_process';
import { createSocketServer, getSocketPath, getSocketResource } from './sock';
import { IGNORED_ERRORS, isNullish, pause, resume, write } from './utils';
import {
  AudioCodec, AudioDecoder, AudioEncoder, Demuxer, Format, Muxer,
  SubtitleCodec, SubtitleDecoder, SubtitleEncoder, VideoCodec,
  VideoDecoder, VideoEncoder
} from './_types';
import { probe, ProbeOptions, ProbeResult } from './probe';
import { createInterface as readlines } from 'readline';
import { extractMessage, FFmpegError } from './errors';
import { getFFmpegPath } from './env';
import { Server } from 'net';
import { Readable } from 'stream';

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
   * Enabled piping the conversion progress, if set to `false` {@link FFmpegProcess.progress}
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
  format(format: Format | Demuxer | (string & {})): this;
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

/** @public */
export interface FFmpegProcess {
  /**
   * Returns the process identifier (PID) of the process.
   */
  readonly pid: number;
  /**
   * The command line arguments used to spawn the process.
   */
  readonly args: readonly string[];
  /**
   * Path of the running ffmpeg executable.
   */
  readonly ffmpegPath: string;
  /**
   * Returns an AsyncGenerator representing the real-time progress of the conversion.
   * @example
   * ```ts
   * const process = await cmd.spawn();
   * for await (const progress of process.progress()) {
   *   console.log('Speed:', progress.speed);
   * }
   * ```
   * Using NodeJS Streams:
   * ```ts
   * const process = await cmd.spawn();
   * const progressStream = Readable.from(process.progress());
   * progressStream.on('data', (progress) => {
   *   console.log('Speed:', progress.speed);
   * });
   * ```
   */
  progress(): AsyncGenerator<Progress, void, void>;
  /**
   * Returns a Promise which resolves when the process exits, or rejects when the
   * process exits with a non-zero status code.
   * @example
   * ```ts
   * const process = cmd.spawn();
   * await process.complete();
   * console.log('Conversion complete!');
   * ```
   * To handle errors:
   * ```ts
   * const process = await cmd.spawn();
   * try {
   *   await process.complete();
   *   console.log('Conversion complete!');
   * } catch (e) {
   *   console.error('Conversion failed!', error);
   * }
   * ```
   */
  complete(): Promise<void>;
  /**
   * Aborts the conversion but allows FFmpeg to end the generated files correctly.
   * This method doesn't wait for the process to exit, you will still have to
   * `await` {@link FFmpegProcess.complete} and catch possible errors.
   */
  abort(): Promise<void>;
  /**
   * Returns the underlying NodeJS' ChildProcess instance.
   */
  unwrap(): ChildProcess;
  /**
   * **UNSTABLE**: Deprecated, not for use in new projects.
   *
   * Sends a signal to the running process.
   * See {@link https://nodejs.org/api/child_process.html#child_process_subprocess_kill_signal}
   *
   * @deprecated To terminate the conversion use {@link FFmpegProcess.abort}, to pause and resume
   * the process use {@link FFmpegProcess.pause} or {@link FFmpegProcess.resume}. If you really
   * have to send a signal to the process use `process.unwrap().kill(signal)`.
   *
   * @param signal - The signal to send.
   */
  kill(signal?: NodeJS.Signals | number): boolean;
  /**
   * Pauses the conversion, returns `true` if the operation succeeds, `false` otherwise.
   */
  pause(): boolean;
  /**
   * Resumes the conversion, returns `true` if the operation succeeds, `false` otherwise.
   */
  resume(): boolean;
}

/**
 * Create a new FFmpegCommand.
 * @param options -
 * @public
 */
export function ffmpeg(options?: FFmpegOptions): FFmpegCommand {
  return new Command(options);
}

/**
 * Start an FFmpeg process with the given arguments.
 * @param args - The arguments to spawn FFmpeg with.
 * @param ffmpegPath - Path to the ffmpeg executable. Defaults to `getFFmpegPath()`.
 * @public
 */
export function spawn(args: string[], ffmpegPath: string = getFFmpegPath()): FFmpegProcess {
  return new Process(ffmpegPath, args, [], []);
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
    return new Process(ffmpegPath, args, inputSocketServers, outputSocketServers);
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

class Process implements FFmpegProcess {
  #process: ChildProcessWithoutNullStreams;
  #stderr: string[] | undefined;

  constructor(public ffmpegPath: string, public args: string[], inputSocketServers: Server[], outputSocketServers: Server[]) {
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
    this.#process = process;
  }
  get pid(): number {
    return this.#process.pid;
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    return this.#process.kill(signal);
  }
  abort() {
    const stdin = this.#process.stdin;
    if (!stdin.writable)
      throw new TypeError('Unable to abort the process, stdin not writable');
    return write(stdin, new Uint8Array([113, 13, 10])); // => writes 'q\r\n'
  }
  pause(): boolean {
    const process = this.#process;
    if (!isNullish(process.exitCode))
      return false;
    return pause(process);
  }
  resume(): boolean {
    const process = this.#process;
    if (!isNullish(process.exitCode))
      return false;
    return resume(process);
  }
  complete(): Promise<void> {
    const process = this.#process;
    const { exitCode } = process;
    return new Promise((resolve, reject) => {
      const abruptComplete = async (exitCode: number): Promise<void> => {
        if (!this.#stderr) {
          const stderr: string[] = this.#stderr = [];
          if (process.stderr.readable) {
            for await (const line of readlines(process.stderr)) {
              stderr.push(line);
            }
          }
        }
        const message = extractMessage(this.#stderr) ??
          `FFmpeg exited with code ${exitCode}`;
        reject(new FFmpegError(message, this.#stderr));
      };
      if (!isNullish(exitCode) || this.#stderr) {
        if (exitCode === 0) resolve();
        else abruptComplete(exitCode!);
      } else {
        const onExit = (exitCode: number): void => {
          if (exitCode === 0) resolve();
          else abruptComplete(exitCode);
          process.off('error', onError);
          process.off('exit', onExit);
        };
        const onError = (): void => {
          const { exitCode } = process;
          if (!isNullish(exitCode)) onExit(exitCode);
        };
        process.on('error', onError);
        process.on('exit', onExit);
      }
    });
  }
  progress(): AsyncGenerator<Progress, void, void> {
    return createProgressGenerator(this.#process.stdout);
  }
  unwrap(): ChildProcess {
    return this.#process;
  }
}

const inputPathMap = new WeakMap<Input, string>();
const inputStreamMap = new WeakMap<Input, NodeJS.ReadableStream>();
class Input implements FFmpegInput {
  #resource: string;
  #format: Format | Demuxer | undefined;
  #codec: VideoCodec | VideoDecoder | AudioCodec | AudioDecoder | SubtitleCodec | SubtitleDecoder | undefined;
  #videoCodec: VideoCodec | VideoDecoder | undefined;
  #audioCodec: AudioCodec | AudioDecoder | undefined;
  #subtitleCodec: SubtitleCodec | SubtitleDecoder | undefined;
  #duration: number | undefined;
  #start: number | undefined;
  #offset: number | undefined;
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
    this.#offset = offset;
    return this;
  }
  duration(duration: number): this {
    this.#duration = duration;
    return this;
  }
  start(start: number): this {
    this.#start = start;
    return this;
  }
  format(format: Format | Demuxer): this {
    this.#format = format;
    return this;
  }
  codec(codec: VideoCodec | VideoDecoder | AudioCodec | AudioDecoder | SubtitleCodec | SubtitleDecoder): this {
    this.#codec = codec;
    return this;
  }
  videoCodec(codec: VideoCodec | VideoDecoder): this {
    this.#videoCodec = codec;
    return this;
  }
  audioCodec(codec: AudioCodec | AudioDecoder): this {
    this.#audioCodec = codec;
    return this;
  }
  subtitleCodec(codec: SubtitleCodec | SubtitleDecoder): this {
    this.#subtitleCodec = codec;
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
    const duration = this.#duration;
    const start = this.#start;
    const offset = this.#offset;
    const format = this.#format;
    const codec = this.#codec;
    const videoCodec = this.#videoCodec;
    const audioCodec = this.#audioCodec;
    const subtitleCodec = this.#subtitleCodec;
    return [
      ...this.#args,
      ...(start !== void 0 ? ['-ss', `${start}ms`] : []),
      ...(duration !== void 0 ? ['-t', `${duration}ms`] : []),
      ...(offset !== void 0 ? ['-itsoffset', `${offset}ms`] : []),
      ...(codec !== void 0 ? ['-c', codec] : []),
      ...(videoCodec !== void 0 ? ['-c:V', videoCodec] : []),
      ...(audioCodec !== void 0 ? ['-c:a', audioCodec] : []),
      ...(subtitleCodec !== void 0 ? ['-c:s', subtitleCodec] : []),
      ...(format !== void 0 ? ['-f', format] : []),
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
  #format: Format | Muxer | undefined;
  #codec: VideoCodec | VideoEncoder | AudioCodec | AudioEncoder | SubtitleCodec | SubtitleEncoder | undefined;
  #videoCodec: VideoCodec | VideoEncoder | undefined;
  #audioCodec: AudioCodec | AudioEncoder | undefined;
  #subtitleCodec: SubtitleCodec | SubtitleEncoder | undefined;
  #metadata: [Record<string, string>, string?] | undefined;
  #duration: number | undefined;
  #start: number | undefined;
  #streams: string[] | undefined;
  #args: string[] = [];
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
  metadata(metadata: Record<string, string>, specifier?: string): this {
    this.#metadata = [metadata, specifier];
    return this;
  }
  map(...streams: string[]): this {
    this.#streams = streams;
    return this;
  }
  format(format: Format | Muxer): this {
    this.#format = format;
    return this;
  }
  codec(codec: VideoCodec | VideoEncoder | AudioCodec | AudioEncoder | SubtitleCodec | SubtitleEncoder): this {
    this.#codec = codec;
    return this;
  }
  videoCodec(codec: VideoCodec | VideoEncoder): this {
    this.#videoCodec = codec;
    return this;
  }
  audioCodec(codec: AudioCodec | AudioEncoder): this {
    this.#audioCodec = codec;
    return this;
  }
  subtitleCodec(codec: SubtitleCodec | SubtitleEncoder): this {
    this.#subtitleCodec = codec;
    return this;
  }
  duration(duration: number): this {
    this.#duration = duration;
    return this;
  }
  start(start: number): this {
    this.#start = start;
    return this;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    const toMetadataArgs = ([metadata, specifier]: [Record<string, string>, string?]) => {
      return ([] as string[]).concat(...Object.entries(metadata).map(([key, value]) => {
        return [`-metadata${specifier ? ':' + specifier : ''}`, `${key}=${value}`];
      }));
    };
    const duration = this.#duration;
    const start = this.#start;
    const metadata = this.#metadata;
    const streams = this.#streams;
    const format = this.#format;
    const codec = this.#codec;
    const videoCodec = this.#videoCodec;
    const audioCodec = this.#audioCodec;
    const subtitleCodec = this.#subtitleCodec;
    return [
      ...this.#args,
      ...(start !== void 0 ? ['-ss', `${start}ms`] : []),
      ...(duration !== void 0 ? ['-t', `${duration}ms`] : []),
      ...(metadata !== void 0 ? toMetadataArgs(metadata) : []),
      ...(streams !== void 0 ? ([] as string[]).concat(...streams.map(
        (stream) => ['-map', stream]
      )) : []),
      ...(codec !== void 0 ? ['-c', codec] : []),
      ...(videoCodec !== void 0 ? ['-c:V', videoCodec] : []),
      ...(audioCodec !== void 0 ? ['-c:a', audioCodec] : []),
      ...(subtitleCodec !== void 0 ? ['-c:s', subtitleCodec] : []),
      ...(format !== void 0 ? ['-f', format] : []),
      this.#resource,
    ];
  }
}

async function* createProgressGenerator(stream: NodeJS.ReadableStream) {
  let progress: Partial<Progress> = {};
  for await (const line of readlines(stream)) {
    try {
      const [key, rawValue] = line.split('=');
      const value = rawValue.trim();
      switch (key.trim()) {
        case 'frame':
          progress.frames = parseInt(value, 10) >>> 0;
          break;
        case 'fps':
          progress.fps = parseFloat(value) || 0;
          break;
        case 'bitrate':
          progress.bitrate = parseFloat(value) || 0;
          break;
        case 'total_size':
          progress.bytes = parseInt(value, 10) >>> 0;
          break;
        case 'out_time_us':
          progress.time = parseInt(value, 10) / 1000 >>> 0;
          break;
        case 'dup_frames':
          progress.framesDuped = parseInt(value, 10) >>> 0;
          break;
        case 'drop_frames':
          progress.framesDropped = parseInt(value, 10) >>> 0;
          break;
        case 'speed':
          progress.speed = parseFloat(value) || 0;
          break;
        case 'progress':
          yield progress as Progress;
          if (value === 'end')
            return;
          progress = {};
          break;
      }
    } catch {
      // Errors are not relevant.
    }
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
