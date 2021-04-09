import * as childProcess from 'child_process';
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
export type InputSource = string | Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
/** @public */
export type OutputDestination = string | NodeJS.WritableStream;
/** @public */
export type ConcatSource = InputSource
  | {
    file: InputSource;
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
   * Concatenate media files using the `concat` demuxer. This can also be used with stream copy, so
   * it is much faster than the `concat` filter for most applications.
   * @param sources - The input sources to be concatenated, they can be in different formats but
   * they must have the same streams, codecs, timebases, etc...
   * {@link https://ffmpeg.org/ffmpeg-formats.html#concat-1}
   * {@link https://trac.ffmpeg.org/wiki/Concatenate}
   * @example
   * ```ts
   * const cmd = ffmpeg();
   * cmd.concat(['file:chunk1.webm', 'file:chunk2.webm']);
   * cmd.output('complete_video.webm');
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
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

/** @public */
export interface ConcatOptions {
  safe?: boolean;
  protocols?: string[];
  useDataURI?: boolean;
  // TODO: add support for using an intermediate file
}

/** @public */
export interface SpawnOptions {
  /**
   * Enable processing of FFmpeg's logs. When set, on each log message written by ffmpeg, depending
   * on the log level, the corresponding log function will be called. Note that with very verbose
   * log levels it may have a noticeable effect on performance.
   */
  logger?: FFmpegLogger | false;
  /**
   * Enable dumping full command line args and logs to a specified file.
   * {@link https://ffmpeg.org/ffmpeg-all.html#Generic-options}
   * @defaultValue `false`
   */
  report?: ReportOptions | boolean;
  /**
   * **EXPERIMENTAL**
   * @defaultValue `false`
   */
  parseLogs?: boolean;
  /** Path to the ffmpeg executable. */
  ffmpegPath?: string;
  /**
   * Add custom options that will be used to spawn the process.
   * {@link https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_spawn_command_args_options}
   */
  spawnOptions?: childProcess.SpawnOptions;
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
  /** Change the log level used for FFmpeg's logs. */
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
   * Get information about the input, this is especially helpful when working
   * with streams. If the source is a stream `options.probeSize` number of bytes
   * will be read and passed to ffprobe; those bytes will be kept in memory
   * until the input is used in conversion.
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
  /** Returns all the arguments for the input. */
  getArgs(): string[];
  /** Whether the input is a stream. */
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
   * the key will be deleted. Values
   * {@link https://ffmpeg.org/ffmpeg.html#Main-options}
   * @param metadata - The metadata to add to the stream or output.
   * @param stream - The stream to add metadata to, if not given `metadata`
   * will be added to the output file.
   */
  metadata(metadata: Record<string, string | undefined | null>, stream?: string): this;
  /** Returns all the arguments for the output. */
  getArgs(): string[];
  /** Whether the output is using streams. */
  readonly isStream: boolean;
}

/**
 * A snapshot of the current progress.
 * @public
 */
export interface Progress {
  /**
   * Total number of frames rendered.
   *
   * @remarks
   * A positive integer, or `undefined` when the inputs have no video streams.
   */
  frames?: number;
  /**
   * Frames per second currently processing.
   *
   * @remarks
   * A positive float which has up to two decimal places, or `undefined` when when the inputs have
   * no video streams.
   */
  fps?: number;
  /**
   * Average bitrate of the output **in kilobits per second**.
   *
   * @remarks
   * A positive float which has one decimal place, or `undefined` when unavailable.
   */
  bitrate?: number;
  /**
   * Total size of the file rendered.
   *
   * @remarks
   * A positive integer, or `undefined` when unavailable.
   */
  size?: number;
  /**
   * Total length of the file rendered, in milliseconds.
   *
   * @remarks
   * A positive integer, or `undefined` when unavailable.
   */
  time?: number;
  /** Total number of frames duplicated. */
  framesDuped: number;
  /** Total number of frames dropped. */
  framesDropped: number;
  /**
   * Current speed of the conversion.
   *
   * @remarks
   * A positive float which has up to three decimal places, or `undefined` when unavailable.
   */
  speed?: number;
}

/** @public */
export interface FFmpegProcess {
  /** Command line arguments used to spawn the process. */
  readonly args: readonly string[];
  /** Path of the running ffmpeg executable. */
  readonly ffmpegPath: string;
  /** @alpha */
  readonly logs: Promise<Logs> | undefined;
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
  unwrap(): childProcess.ChildProcess;
  /** Pauses the conversion, returns `true` if the operation succeeds or `false` if it fails. */
  pause(): boolean;
  /** Resumes the conversion, returns `true` if the operation succeeds or `false` if it fails. */
  resume(): boolean;
}

/* eslint-disable camelcase */

/** @alpha */
export interface RawProbeResult {
  format: RawProbeFormat;
  streams: RawProbeStream[];
  chapters: RawProbeChapter[];
  error?: RawProbeError;
}

/** @alpha */
export interface RawProbeError {
  code: number;
  string: string;
}

// https://github.com/FFmpeg/FFmpeg/blob/9d8f9b2e4094ae6b07a9f23ae044b802722b3b4e/fftools/ffprobe.c#L2807
/** @alpha */
export interface RawProbeFormat {
  [key: string]: any;

  filename?: string;

  nb_streams: number;
  nb_programs: number;

  format_name?: string;
  format_long_name?: string;

  start_time: string;
  duration: string;
  size?: string;
  bit_rate?: string;

  probe_score: number;

  tags?: Record<string, string>;
}

// https://github.com/FFmpeg/FFmpeg/blob/9d8f9b2e4094ae6b07a9f23ae044b802722b3b4e/fftools/ffprobe.c#L2485
/** @alpha */
export type RawProbeStream = {
  [key: string]: any;

  index: number;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  codec_type: 'video';
  codec_time_base?: string;
  codec_tag_string: string;
  codec_tag: string;

  id?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: string;
  start_time?: string;
  duration_ts?: string;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;
  bits_per_raw_sample?: number;
  nb_frames?: number;
  nb_read_frames?: number;
  nb_read_packets?: number;
  disposition?: RawProbeDisposition;

  width: number;
  height: number;
  coded_width?: number;
  coded_height?: number;
  closed_captions?: number;
  has_b_frames: number;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  pix_fmt?: string;
  level: number;
  color_range?: string;
  color_space?: string;
  color_primaries?: string;
  chroma_location?: string;
  field_order?: string;
  timecode?: string;
  refs?: string;
  tags?: Record<string, string>;
} | {
  [key: string]: any;

  index: number;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  codec_type: 'audio';
  codec_time_base?: string;
  codec_tag_string: string;
  codec_tag: string;

  id?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: string;
  start_time?: string;
  duration_ts?: string;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;
  bits_per_raw_sample?: number;
  nb_frames?: number;
  nb_read_frames?: number;
  nb_read_packets?: number;
  disposition?: RawProbeDisposition;

  sample_fmt?: string;
  sample_rate?: string;
  channels?: number;

  channel_layout?: string;
  bits_per_sample?: number;
  tags?: Record<string, string>;
} | {
  [key: string]: any;

  index: number;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  codec_type: 'subtitle';
  codec_time_base?: string;
  codec_tag_string: string;
  codec_tag: string;

  id?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: string;
  start_time?: string;
  duration_ts?: string;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;
  bits_per_raw_sample?: number;
  nb_frames?: number;
  nb_read_frames?: number;
  nb_read_packets?: number;
  disposition?: RawProbeDisposition;
  width?: number;
  height?: number;
  tags?: Record<string, string>;
} | {
  [key: string]: any;

  index: number;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  codec_type?: string;
  codec_time_base?: string;
  codec_tag_string: string;
  codec_tag: string;

  id?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: string;
  start_time?: string;
  duration_ts?: string;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;
  bits_per_raw_sample?: number;
  nb_frames?: number;
  nb_read_frames?: number;
  nb_read_packets?: number;
  disposition?: RawProbeDisposition;
  tags?: Record<string, string>;
};

/** @alpha */
export interface RawProbeDisposition {
  default: number;
  dub: number;
  original: number;
  comment: number;
  lyrics: number;
  karaoke: number;
  forced: number;
  hearing_impaired: number;
  visual_impaired: number;
  clean_effects: number;
  attached_pic: number;
  timed_thumbnails: number;
}

// https://github.com/FFmpeg/FFmpeg/blob/9d8f9b2e4094ae6b07a9f23ae044b802722b3b4e/fftools/ffprobe.c#L2782
/** @alpha */
export interface RawProbeChapter {
  id: number;
  time_base: string;
  start: number;
  start_time: string;
  end: number;
  end_time: string;
  tags?: Record<string, string>;
}

/* eslint-enable camelcase */

/**
 * **UNSTABLE**: `ProbeResult` is intended to have a simple API but it is still very unfinished, for
 * the time being using `.unwrap()` is necessary to retrieve any useful information from `probe()`.
 *
 * @alpha
 */
export interface ProbeResult {
  format?: Demuxer | Format | (string & {});
  formatName?: string;

  start: number;
  duration: number;

  bitrate?: number;
  score: number;

  tags?: Map<string, string>;

  unwrap(): RawProbeResult;
}

/** @alpha */
export interface ProbeOptions {
  /**
   * Specify the number of bytes to probe, if not given it will not be specified in the command-line
   * arguments.
   */
  probeSize?: number;
  /**
   * Specify the number of milliseconds to analyze, defaults to `5000`.
   */
  analyzeDuration?: number;
  /**
   * Path to the `ffprobe` executable.
   */
  ffprobePath?: string;
  /**
   * Specify the input format of the media to probe.
   */
  format?: Demuxer | Format | (string & {});
  /**
   * Add command line arguments to ffprobe, `args` is appended **after** other
   * arguments, but **before** source.
   */
  args?: string[];
  /**
   * Add custom options that will be used to spawn the process.
   * {@link https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_spawn_command_args_options}
   * @example
   * ```ts
   * const info = await probe('video.mkv', {
   *   spawnOptions: {
   *     timeout: 5000
   *   }
   * });
   * ```
   */
  spawnOptions?: childProcess.SpawnOptions;
}

// For now these interfaces are internal, they should have a similar shape
// as probe() function/method.
/** @alpha */
export interface LoggedFormat {
  file: string;
  name: string;
  start: number;
  duration?: number;
  bitrate?: number;
  metadata: Record<string, string>;
}

/** @alpha */
export interface LoggedStream {
  metadata: Record<string, string>;
}

/** @alpha */
export interface LoggedChapter {
  start: number;
  end: number;
  metadata: Record<string, string>;
}

/** @alpha */
export interface LoggedInput {
  format: LoggedFormat;
  streams: LoggedStream[];
  chapters: LoggedChapter[];
}

/** @alpha */
export interface Logs {
  inputs: LoggedInput[];
}
