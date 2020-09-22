import { AudioCodec, ChannelLayout, ChromaLocation, ColorRange, ColorSpace, DataCodec, Demuxer, FieldOrder, PixelFormat, SampleFormat, SubtitleCodec, VideoCodec } from './_types';

export * from './_types';

export enum LogLevel {
  Quiet = -8,
  Panic = 0,
  Fatal = 8,
  Error = 16,
  Warning = 24,
  Info = 32,
  Verbose = 40,
  Debug = 48,
  Trace = 56,
}

/**
 * Metadata tags, a Map of string-string pairs, the keys are lowercased.
 */
export type Tags = Map<string, string>;

export abstract class BaseStream {
  /**
   * Zero-based index of the stream. Used to map streams.
   */
  readonly index: number;
  readonly abstract type: string;
  readonly abstract codec: string;
  /**
   * Human readable representing the stream's codec.
   */
  readonly codecName: string;
  /**
   * Codec tag, used by the `codecs` parameter in MIME Types.
   */
  readonly codecTag?: string;
  /**
   * Start of the stream in milliseconds.
   */
  readonly start: number;
  /**
   * Duration of the stream in milliseconds.
   */
  readonly duration: number;
  /**
   * Bit rate in bits/s.
   */
  readonly bitrate: number;
  /**
   * Custom metadata tags.
   */
  readonly tags: Tags;
  readonly frames: number;

  /** @internal */
  constructor (stream: RawProbeStream) {
    probeStreamMap.set(this, stream);

    this.index = stream.index >>> 0;
    this.codecName = '' + stream.codec_long_name;
    const tag = codecTag(stream.codec_tag_string);
    if (tag) this.codecTag = tag;
    this.start = +stream.start_time * 1000 | 0;
    this.duration = +stream.duration * 1000 | 0;
    this.bitrate = int(stream.bit_rate);
    this.frames = stream.nb_frames >>> 0;
    this.tags = tags(stream.tags);
  }

  /**
   * Unwrap the enhanced instance back to its untouched plain object form. This
   * is useful if you need to access properties which are not (yet) wrapped.
   * Please open an issue or a pull request to wrap those properties ;)
   * @example ```typescript
   * const stream = probeResult.streams[0]; // get your stream
   * const rawStream = stream.unwrap();
   * rawStream.has_b_frames === 0
   * ```
   */
  unwrap(): RawProbeStream {
    return probeStreamMap.get(this)!;
  }
}

export class VideoStream extends BaseStream {
  readonly type: 'video' = 'video';
  /**
   * The video's codec.
   */
  readonly codec: Maybe<VideoCodec>;
  /**
   * The video's profile, some codecs don't require this.
   */
  readonly profile?: string;
  /**
   * The width of the video stream in pixels.
   */
  readonly width: number;
  /**
   * The height of the video stream in pixels.
   */
  readonly height: number;
  /**
   * The width used by the coder in pixels.
   */
  readonly codedWidth: number;
  /**
   * The height used by the coder in pixels.
   */
  readonly codedHeight: number;

  /**
   * The aspect ratio of the video stream as a string, e.g. `16:9`.
   */
  readonly aspectRatio: string;
  readonly pixelFormat: Maybe<PixelFormat>;
  readonly level: number;
  readonly colorRange: Maybe<ColorRange>;
  readonly colorSpace: Maybe<ColorSpace>;
  readonly colorTransfer: string;
  readonly colorPrimaries: string;
  readonly chromaLocation: Maybe<ChromaLocation>;
  readonly fieldOrder: Maybe<FieldOrder>;
  readonly frameRate: number;
  readonly avgFrameRate: number;
  readonly bitsPerRawSample: number;

  /** @internal */
  constructor (stream: RawProbeStream) {
    super(stream);
    this.codec = '' + stream.codec_name as VideoCodec;
    if (stream.profile) this.profile = '' + stream.profile;
    this.width = int(stream.width);
    this.height = int(stream.height);
    this.codedWidth = int(stream.coded_width);
    this.codedHeight = int(stream.coded_height);
    this.aspectRatio = '' + stream.display_aspect_ratio;
    this.pixelFormat = '' + (stream.pix_fmt || 'unknown') as PixelFormat;
    this.level = stream.level >>> 0;
    this.colorRange = '' + (stream.color_range || 'unknown') as ColorRange;
    this.colorSpace = '' + (stream.color_space || 'unknown') as ColorSpace;
    this.colorTransfer = '' + (stream.color_transfer || 'unknown');
    this.colorPrimaries = '' + (stream.color_primaries || 'unknown');
    this.chromaLocation = '' + (stream.chroma_location || 'unknown') as ChromaLocation;
    this.fieldOrder = '' + (stream.field_order || 'unknown') as FieldOrder;
    this.frameRate = f64(stream.r_frame_rate);
    this.avgFrameRate = f64(stream.avg_frame_rate);
    this.bitsPerRawSample = stream.bits_per_raw_sample >>> 0;
  }
}

export class AudioStream extends BaseStream {
  readonly type: 'audio' = 'audio';
  readonly codec: Maybe<AudioCodec>;
  readonly profile?: string;
  readonly sampleFormat: Maybe<SampleFormat>;
  readonly sampleRate: number;
  readonly channels: number;
  readonly channelLayout: Maybe<ChannelLayout>;
  readonly bitsPerSample: number;

  /** @internal */
  constructor (stream: RawProbeStream) {
    super(stream);
    this.codec = '' + stream.codec_name as AudioCodec;
    if (stream.profile) this.profile = '' + stream.profile;
    this.sampleFormat = '' + stream.sample_fmt as SampleFormat;
    this.sampleRate = stream.sample_rate >>> 0;
    this.channels = stream.channels >>> 0;
    this.channelLayout = '' + stream.channel_layout as ChannelLayout;
    this.bitsPerSample = stream.bits_per_sample >>> 0;
  }
}

export class SubtitleStream extends BaseStream {
  readonly type: 'subtitle' = 'subtitle';
  readonly codec: Maybe<SubtitleCodec>;

  /** @internal */
  constructor (stream: RawProbeStream) {
    super(stream);
    this.codec = '' + stream.codec_name as SubtitleCodec;
  }
}

export class DataStream extends BaseStream {
  readonly type: 'data' = 'data';
  readonly codec: Maybe<DataCodec>;

  /** @internal */
  constructor (stream: RawProbeStream) {
    super(stream);
    this.codec = '' + stream.codec_name as DataCodec;
  }
}

export type Stream = VideoStream | AudioStream | SubtitleStream | DataStream;

export class Chapter {
  readonly id: number;
  /**
   * Start of the chapter in milliseconds.
   */
  readonly start: number;
  /**
   * End of the chapter in milliseconds.
   */
  readonly end: number;
  /**
   * Custom metadata tags.
   */
  readonly tags: Tags;

  /** @internal */
  constructor (chapter: RawProbeChapter) {
    probeChapterMap.set(this, chapter);
    this.id = chapter.id >>> 0;
    this.start = chapter.start * 1000000 | 0;
    this.end = chapter.end * 1000000 | 0;
    this.tags = tags(chapter.tags);
  }

  /**
   * Unwrap the enhanced instance back to its untouched plain object form. This
   * is useful if you need to access properties which are not (yet) wrapped.
   * Please open an issue or a pull request to wrap those properties ;)
   */
  unwrap(): RawProbeChapter {
    return probeChapterMap.get(this)!;
  }
}

export class ProbeResult {
  readonly format: Demuxer;
  /**
   * Start of the file in milliseconds.
   */
  readonly start: number;
  /**
   * Total duration of the file in milliseconds.
   */
  readonly duration: number;
  /**
   * Total bit rate in bits/s.
   */
  readonly bitrate: number;
  /**
   * FFprobe's score, integer between 0-100.
   */
  readonly score: number;
  /**
   * Custom metadata tags.
   */
  readonly tags: Tags;

  // TODO: support programs
  // programs: number;
  readonly streams: Stream[];
  readonly chapters: Chapter[];

  /** @internal */
  constructor (result: RawProbeResult) {
    probeResultMap.set(this, result);

    const formatInfo = result.format;

    this.format = '' + formatInfo.format_name as Demuxer;
    this.start = +formatInfo.start_time * 1000 | 0;
    this.duration = +formatInfo.duration * 1000 | 0;
    this.bitrate = int(formatInfo.bit_rate);
    this.score = formatInfo.probe_score | 0;
    this.tags = tags(formatInfo.tags);
    this.streams = result.streams.map(toStream);
    this.chapters = result.chapters.map((info) => new Chapter(info));
  }

  /**
   * Unwrap the enhanced instance back to its untouched plain object form. This
   * is useful if you need to access properties which are not (yet) wrapped.
   * Please open an issue or a pull request to wrap those properties ;)
   */
  unwrap(): RawProbeResult {
    return probeResultMap.get(this)!;
  }
}

/* eslint-disable camelcase */
export interface RawProbeChapter {
  id: number;
  [extra: string]: any;
}

export interface RawProbeStream {
  index: number;
  codec_name: string;
  codec_long_name: string;
  codec_type: string;
  codec_tag: string;
  codec_tag_string: string;
  [extra: string]: any;
}

export interface RawProbeResult {
  format: {
    filename?: string;
    nb_streams: number;
    nb_programs: number;
    format_name: string,
    format_long_name: string,
    start_time: number,
    duration: number,
    size?: number,
    bit_rate?: number,
    probe_score: number,
    tags: Record<string, string>;
    [extra: string]: any;
  };
  streams: RawProbeStream[];
  chapters: RawProbeChapter[];
  [extra: string]: any;
}
/* eslint-enable camelcase */

type Maybe<T> = T | 'unknown';

const probeResultMap = new WeakMap<ProbeResult, RawProbeResult>();
const probeStreamMap = new WeakMap<BaseStream, RawProbeStream>();
const probeChapterMap = new WeakMap<Chapter, RawProbeChapter>();

function toLowerCase([key, value]: [string, any]): [string, string] {
  return [key.toLowerCase(), '' + value];
}

function tags(o: any): Tags {
  return new Map(Object.entries(o || {}).map(toLowerCase));
}

function codecTag(o: any) {
  const s = '' + o;
  return !o || s === '[0][0][0][0]' ? null : s;
}

function f64(fraction: any) {
  const [x, y] = ('' + fraction).split('/');
  if (!x || !y) return -1;
  const a = +x;
  const b = +y;
  if (a !== a || b !== b) return -1;
  return a / b;
}

function int(x: any) {
  return Math.floor(+x);
}

function toStream(streamInfo: any) {
  const type = '' + streamInfo.codec_type;
  if (type === 'video') return new VideoStream(streamInfo);
  if (type === 'audio') return new AudioStream(streamInfo);
  if (type === 'subtitle') return new SubtitleStream(streamInfo);
  return new DataStream(streamInfo);
}
