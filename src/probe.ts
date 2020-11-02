import { ChildProcessWithoutNullStreams, spawn, SpawnOptions } from 'child_process';
import { IGNORED_ERRORS, isNullish, read, toReadable } from './utils';
import { createInterface as readlines } from 'readline';
import { InputSource, LogLevel } from './command';
import { FFprobeError } from './errors';
import { getFFprobePath } from './env';
import { Demuxer, Format } from './_types';

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
   * **UNSTABLE**: Support for logging is under consideration.
   *
   * Set the log level used by ffprobe.
   * @alpha
   */
  logLevel?: LogLevel;
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
  spawnOptions?: SpawnOptions;
}

/**
 * **UNSTABLE**
 *
 * Probes the given `source` using ffprobe.
 * @param source - The source to probe. Accepts the same types as `FFmpegCommand.input()`.
 * @param options - Customize ffprobe options.
 * @example
 * ```ts
 * const result = await probe('input.mp4');
 * console.log(result.format);
 * ```
 * @alpha
 */
export async function probe(source: InputSource, options: ProbeOptions = {}): Promise<ProbeResult> {
  const {
    probeSize,
    analyzeDuration,
    ffprobePath = getFFprobePath(),
    logLevel = LogLevel.Error,
    format,
    args = [],
    spawnOptions = {},
  } = options;
  const ffprobe = spawn(ffprobePath, [
    '-v', logLevel.toString(),
    ...(probeSize !== void 0 ? ['-probesize', probeSize.toString()] : []),
    ...(analyzeDuration !== void 0 ? ['-analyzeduration', (analyzeDuration * 1000).toString()] : []),
    '-of', 'json=c=1',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    '-show_error',
    ...args,
    ...(format !== void 0 ? ['-f', format] : []),
    '-i',
    typeof source === 'string' ? source : 'pipe:0'
  ], {
    stdio: 'pipe',
    ...spawnOptions,
  }) as ChildProcessWithoutNullStreams;
  const { stdin, stdout, stderr } = ffprobe;
  const extractError = async (error: RawProbeError): Promise<FFprobeError> => {
    const logs: string[] = [];
    if (stderr.readable) for await (const line of readlines(stderr)) {
      logs.push(line);
    }
    return new FFprobeError(error.string, logs, error.code);
  };
  try {
    if (source instanceof Uint8Array) {
      writeStdin(stdin, source);
    } else if (typeof source !== 'string') {
      pipeStdin(stdin, toReadable(source));
    }
    const output = await read(stdout);
    const raw: RawProbeResult = JSON.parse(output.toString('utf-8'));
    if (raw.error)
      throw await extractError(raw.error);
    await new Promise((resolve) => ffprobe.once('exit', resolve));
    return new Result(raw);
  } finally {
    if (isNullish(ffprobe.exitCode))
      ffprobe.kill();
  }
}

class Result implements ProbeResult {
  #raw: RawProbeResult;

  constructor(raw: RawProbeResult) {
    this.#raw = raw;
    if (raw.format.format_name)
      this.format = raw.format.format_name;
    if (raw.format.format_long_name)
      this.formatName = raw.format.format_long_name;
    this.start = +raw.format.start_time * 1000 | 0;
    this.duration = +raw.format.duration * 1000 | 0;
    this.score = raw.format.probe_score >>> 0;
    if (raw.format.tags)
      this.tags = tags(raw.format.tags);
  }

  format?: Demuxer | Format | (string & {});
  formatName?: string;
  start: number;
  duration: number;
  bitrate?: number;
  score: number;
  tags?: Map<string, string>;

  unwrap(): RawProbeResult {
    return this.#raw;
  }
}

function writeStdin(stdin: NodeJS.WritableStream, u8: Uint8Array) {
  return new Promise((resolve, reject) => {
    const unlisten = (): void => {
      stdin.off('error', onError);
      stdin.off('close', onClose);
    };
    const onError = (error: Error & { code: string }): void => {
      if (!IGNORED_ERRORS.has(error.code)) {
        unlisten();
        reject(error);
      }
    };
    const onClose = (): void => {
      unlisten();
      resolve();
    };
    stdin.on('close', onClose);
    stdin.on('error', onError);
    stdin.end(u8);
  });
}

function pipeStdin(stdin: NodeJS.WritableStream, stream: NodeJS.ReadableStream) {
  return new Promise((resolve, reject) => {
    const unlisten = (): void => {
      stream.off('error', onStreamError);
      stdin.off('error', onError);
      stdin.off('close', onClose);
    };
    const onError = (error: Error & { code: string }): void => {
      if (!IGNORED_ERRORS.has(error.code)) {
        unlisten();
        reject(error);
      }
    };
    const onStreamError = (error: Error): void => {
      if (stdin.writable)
        stdin.end();
      unlisten();
      reject(error);
    };
    const onClose = (): void => {
      unlisten();
      resolve();
    };
    stream.on('error', onStreamError);
    stdin.on('close', onClose);
    stdin.on('error', onError);
    stream.pipe(stdin);
  });
}

function tags(o: any): Map<string, string> {
  return new Map(Object.entries(o).map(([key, value]) => [key.toLowerCase(), '' + value]));
}
