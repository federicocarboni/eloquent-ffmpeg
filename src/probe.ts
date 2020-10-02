import { BufferLike, end, isBufferLike, read, toUint8Array, write } from './utils';
import { InputSource, LogLevel } from './command';
import { getFFprobePath } from './env';
import { __asyncValues } from 'tslib';
import { spawn } from 'child_process';
import { Demuxer } from './_types';

/* eslint-disable camelcase */
export interface RawProbeResult {
  format: RawProbeFormat;
  streams: RawProbeStream[];
  chapters: RawProbeChapter[];
  error?: RawProbeError;
}

export interface RawProbeError {
  code: number;
  string: string;
}

// https://github.com/FFmpeg/FFmpeg/blob/9d8f9b2e4094ae6b07a9f23ae044b802722b3b4e/fftools/ffprobe.c#L2807
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
export interface RawProbeChapter {
  id: number;
  time_base: string;
  start: number;
  start_time: string;
  end: number;
  end_time: string;
  tags?: Record<string, string>;
}

/* eslint-enable */

export interface ProbeResult {
  format?: Demuxer;
  formatName?: string;

  start: number;
  duration: number;

  bitrate?: number;
  score: number;

  tags?: Map<string, string>;

  unwrap(): RawProbeResult;
}

export interface ProbeOptions {
  /**
   * Specify the number of bytes to probe, defaults to `5 * 1024 * 1024`, `5MiB`.
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
   * Set the log level used by ffprobe.
   */
  logLevel?: LogLevel;
  /**
   * Add command line arguments to ffprobe, `args` is appended **after** other
   * arguments, but **before** source.
   */
  args?: string[];
}

/**
 * Probes the given `source` using ffprobe.
 * @param source The source to probe. Accepts the same types as `FFmpegCommand.input()`.
 * @param options Customize ffprobe options.
 * @example ```ts
 * const result = await probe('input.mp4');
 * console.log(result.format);
 * ```
 */
export async function probe(source: InputSource, options: ProbeOptions = {}): Promise<ProbeResult> {
  const {
    probeSize,
    analyzeDuration = 5000,
    ffprobePath = getFFprobePath(),
    logLevel = LogLevel.Error,
    args = []
  } = options;
  const ffprobe = spawn(ffprobePath, [
    '-v', logLevel.toString(),
    ...(probeSize !== void 0 ? ['-probesize', probeSize.toString()] : []),
    '-analyzeduration', (analyzeDuration * 1000).toString(),
    '-of', 'json=c=1',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    '-show_error',
    ...args,
    typeof source === 'string' ? source : 'pipe:0'
  ], { stdio: 'pipe' });
  const { stdin, stdout, stderr } = ffprobe;
  try {
    if (isBufferLike(source))
      await writeStdin(stdin, toUint8Array(source));
    else if (typeof source !== 'string')
      await pipeStdin(stdin, __asyncValues(source));
    const output = await read(stdout);
    const raw: RawProbeResult = JSON.parse(output.toString('utf-8'));
    if (raw.error) {
      const errors = await read(stderr);
      // TODO: add custom exception
      throw new Error(errors.toString('utf-8'));
    }
    return new Result(raw);
  } finally {
    if (ffprobe.exitCode === null) ffprobe.kill();
  }
}

const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

class Result implements ProbeResult {
  #raw: RawProbeResult;

  constructor(raw: RawProbeResult) {
    this.#raw = raw;
    if (raw.format.format_name)
      this.format = raw.format.format_name as Demuxer;
    if (raw.format.format_long_name)
      this.formatName = raw.format.format_long_name;
    this.start = +raw.format.start_time * 1000 | 0;
    this.duration = +raw.format.duration * 1000 | 0;
    this.score = raw.format.probe_score >>> 0;
    if (raw.format.tags)
      this.tags = tags(raw.format.tags);
  }

  format?: Demuxer | undefined;
  formatName?: string | undefined;
  start: number;
  duration: number;
  bitrate?: number | undefined;
  score: number;
  tags?: Map<string, string> | undefined;

  unwrap(): RawProbeResult {
    return this.#raw;
  }
}

function writeStdin(stdin: NodeJS.WritableStream, u8: Uint8Array) {
  return new Promise((resolve, reject) => {
    const onError = (error: Error & { code: string }): void => {
      if (!IGNORED_ERRORS.has(error.code)) {
        stdin.off('error', onError);
        reject(error);
      }
    };
    stdin.end(u8, () => {
      stdin.off('error', onError);
      resolve();
    });
    stdin.on('error', onError);
  });
}

async function pipeStdin(stdin: NodeJS.WritableStream, stream: AsyncIterableIterator<BufferLike>) {
  try {
    try {
      for await (const chunk of stream) {
        await write(stdin, toUint8Array(chunk));
      }
    } finally {
      if (stdin.writable) await end(stdin);
    }
  } catch {
    // Avoid unhandled rejections.
    // TODO: add logging?
  }
}

function toLowerCase([key, value]: [string, any]): [string, string] {
  return [key.toLowerCase(), '' + value];
}

function tags(o: any): Map<string, string> {
  return new Map(Object.entries(o).map(toLowerCase));
}
