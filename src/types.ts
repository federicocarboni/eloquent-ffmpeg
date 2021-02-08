import { ChildProcess, SpawnOptionsWithoutStdio } from 'child_process';
import { ProbeOptions, ProbeResult } from './probe';
import {
  AudioCodec,
  AudioDecoder,
  AudioEncoder,
  AudioFilter,
  Demuxer,
  Format,
  Muxer,
  SubtitleCodec,
  SubtitleDecoder,
  SubtitleEncoder,
  VideoCodec,
  VideoDecoder,
  VideoEncoder,
  VideoFilter
} from './_types';

/** @public */
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
   * @param options - See {@link SpawnOptions}.
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
  useDataURI?: boolean;
  // TODO: add support for using an intermediate file
}

/** @public */
export interface FFmpegLogger {
  fatal?(message: string): void;
  error?(message: string): void;
  warning?(message: string): void;
  info?(message: string): void;
  verbose?(message: string): void;
  debug?(message: string): void;
  trace?(message: string): void;
}

/** @public */
export interface SpawnOptions {
  /**
   * **UNSTABLE**
   *
   * Define a logger for FFmpeg.
   */
  logger?: FFmpegLogger;
  /**
   * **UNSTABLE**
   *
   * Enable dumping full command line args and logs to a specified file.
   * {@link https://ffmpeg.org/ffmpeg-all.html#Generic-options}
   */
  report?: ReportOptions | boolean;
  /** Path to the ffmpeg executable. */
  ffmpegPath?: string;
  /**
   * Add custom options that will be used to spawn the process.
   * {@link https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_spawn_command_args_options}
   */
  spawnOptions?: SpawnOptionsWithoutStdio;
}

/** @public */
export interface ReportOptions {
  /**
   * A path to the file the report will be written to, relative to the current working directory of
   * FFmpeg. When not given, FFmpeg will write the report to `ffmpeg-YYYYMMDD-HHMMSS.log` in its
   * working directory.
   */
  file?: string;
  /**
   * Change the log level used for the report file, it will not interfere with logging. When not
   * given FFmpeg defaults to `LogLevel.Debug`.
   */
  level?: LogLevel;
}

/** @public */
export interface FFmpegOptions {
  /**
   * **UNSTABLE**
   *
   * Change the log level used for FFmpeg's logs.
   */
  level?: LogLevel;
  /**
   * Enable piping the conversion progress, if set to `false` {@link FFmpegProcess.progress}
   * will silently fail.
   * @defaultValue `true`
   */
  progress?: boolean;
  /**
   * Whether to overwrite the output destinations if they already exist. Required
   * to be `true` for streaming outputs.
   * @defaultValue `true`
   */
  overwrite?: boolean;
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
   * Add metadata to a stream or an output, if a value is `undefined`, `null` or `''` (empty string),
   * the key will be deleted.
   * {@link https://ffmpeg.org/ffmpeg.html#Main-options}
   * @param metadata - The metadata to add to the stream or output.
   * @param specifier - The stream to add metadata to, if not given `metadata`
   * will be added to the output file.
   */
  metadata(metadata: Record<string, string | undefined | null>, specifier?: string): this;
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
export interface FFmpegProcess {
  /**
   * **UNSTABLE:** Deprecated, not for use in new projects.
   *
   * @deprecated Use `FFmpegProcess.unwrap().pid` instead.
   *
   * Returns the process identifier (PID) of the process.
   */
  readonly pid: number;
  /** Command line arguments used to spawn the process. */
  readonly args: readonly string[];
  /** Path of the running ffmpeg executable. */
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
   * Returns a Promise which resolves when the process exits, or rejects when the process exits with
   * a non-zero status code. If the `ChildProcess` emits an `error` event, the Promise will be
   * rejected with that error.
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
   * Aborts the conversion allowing FFmpeg to finish the generated files correctly.
   * This waits for FFmpeg to exit but doesn't guarantee that FFmpeg will succeed,
   * any possible errors should still be handled.
   */
  abort(): Promise<void>;
  /** Returns the underlying NodeJS' ChildProcess instance. */
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
  /** Pauses the conversion, returns `true` if the operation succeeds or `false` if it fails. */
  pause(): boolean;
  /** Resumes the conversion, returns `true` if the operation succeeds or `false` if it fails. */
  resume(): boolean;
}
