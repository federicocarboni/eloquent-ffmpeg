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
  readonly index: number;
  readonly abstract type: string;
  readonly abstract codec: string;
  readonly codecName: string;
  readonly codecTag?: string;
  readonly start: number;
  readonly duration: number;
  readonly bitrate: number;
  readonly tags: Tags;

  /** @internal */
  constructor (info: RawProbeStream) {
    unwrapMap.set(this, info);
    this.index = info.index >>> 0;
    this.codecName = '' + info.codec_long_name;
    const tag = codecTag(info.codec_tag_string);
    if (tag) this.codecTag = tag;

    this.start = +info.start_time * 1000 | 0;
    this.duration = +info.duration * 1000 | 0;
    this.bitrate = int(info.bit_rate);
    this.tags = tags(info.tags);
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
    return unwrapMap.get(this);
  }
}

export class VideoStream extends BaseStream {
  readonly type: 'video' = 'video';
  readonly codec: VideoCodec;
  readonly profile?: string;

  readonly width: number;
  readonly height: number;
  readonly codedWidth: number;
  readonly codedHeight: number;

  readonly aspectRatio: string;
  readonly pixelFormat: PixelFormat;
  readonly level: number;
  readonly colorRange: ColorRange;
  readonly colorSpace: ColorSpace;
  readonly colorTransfer: string;
  readonly colorPrimaries: string;
  readonly chromaLocation: ChromaLocation;
  readonly fieldOrder: FieldOrder;
  readonly frameRate: number;
  readonly avgFrameRate: number;
  readonly bitsPerRawSample: number;

  /** @internal */
  constructor (info: RawProbeStream) {
    super(info);
    this.codec = '' + info.codec_name as VideoCodec;
    if (info.profile) this.profile = ('' + info.profile).toLowerCase();
    this.width = int(info.width);
    this.height = int(info.height);
    this.codedWidth = int(info.coded_width);
    this.codedHeight = int(info.coded_height);
    this.aspectRatio = '' + info.display_aspect_ratio;
    this.pixelFormat = '' + info.pixel_format as PixelFormat;
    this.level = info.level >>> 0;
    this.colorRange = '' + info.color_range as ColorRange;
    this.colorSpace = '' + info.color_space as ColorSpace;
    this.colorTransfer = '' + info.color_transfer;
    this.colorPrimaries = '' + info.color_primaries;
    this.chromaLocation = '' + info.chroma_location as ChromaLocation;
    this.fieldOrder = '' + info.field_order as FieldOrder;
    this.frameRate = f64(info.frame_rate);
    this.avgFrameRate = f64(info.avg_frame_rate);
    this.bitsPerRawSample = info.bits_per_raw_sample >>> 0;
  }
}

export class AudioStream extends BaseStream {
  readonly type: 'audio' = 'audio';
  readonly codec: AudioCodec;
  readonly profile?: string;
  readonly sampleFormat: SampleFormat;
  readonly sampleRate: number;
  readonly channels: number;
  readonly channelLayout: ChannelLayout;
  readonly bitsPerSample: number;
  /** @internal */
  constructor (info: RawProbeStream) {
    super(info);
    this.codec = '' + info.codec_name as AudioCodec;
    if (info.profile) this.profile = ('' + info.profile).toLowerCase();
    this.sampleFormat = '' + info.sample_fmt as SampleFormat;
    this.sampleRate = info.sample_rate >>> 0;
    this.channels = info.channels >>> 0;
    this.channelLayout = '' + info.channel_layout as ChannelLayout;
    this.bitsPerSample = info.bits_per_sample >>> 0;
  }
}

export class SubtitleStream extends BaseStream {
  readonly type: 'subtitle' = 'subtitle';
  readonly codec: SubtitleCodec;
  /** @internal */
  constructor (info: RawProbeStream) {
    super(info);
    this.codec = '' + info.codec_name as SubtitleCodec;
  }
}

export class DataStream extends BaseStream {
  readonly type: 'data' = 'data';
  readonly codec: DataCodec;
  /** @internal */
  constructor (info: RawProbeStream) {
    super(info);
    this.codec = '' + info.codec_name as DataCodec;
  }
}

export type Stream = VideoStream | AudioStream | SubtitleStream | DataStream;

export class Chapter {
  readonly id: number;
  readonly start: number;
  readonly end: number;
  readonly tags: Tags;

  /** @internal */
  constructor (info: any) {
    unwrapMap.set(this, info);
    this.id = info.id >>> 0;
    this.start = info.start * 1000000 | 0;
    this.end = info.end * 1000000 | 0;
    this.tags = tags(info.tags);
  }

  /**
   * Unwrap the enhanced instance back to its untouched plain object form. This
   * is useful if you need to access properties which are not (yet) wrapped.
   * Please open an issue or a pull request to wrap those properties ;)
   */
  unwrap(): RawProbeChapter {
    return unwrapMap.get(this);
  }
}

export class ProbeResult {
  readonly format: Demuxer;

  // TODO: support programs
  // programs: number;
  readonly streams: Stream[];
  readonly chapters: Chapter[];

  readonly bitrate: number;
  readonly duration: number;
  readonly start: number;

  readonly score: number;

  readonly tags: Tags;

  /** @internal */
  constructor (info: any) {
    unwrapMap.set(this, info);
    const formatInfo = info.format;
    this.format = '' + formatInfo.format_name as Demuxer;
    this.start = +formatInfo.start_time * 1000 | 0;
    this.duration = +formatInfo.duration * 1000 | 0;
    this.bitrate = int(formatInfo.bit_rate);
    this.score = formatInfo.probe_score | 0;
    this.tags = tags(formatInfo.tags);
    this.streams = Array.prototype.map.call(info.streams, toStream) as Stream[];
    this.chapters = Array.prototype.map.call(info.chapters, (info) => new Chapter(info)) as Chapter[];
  }

  /**
   * Unwrap the enhanced instance back to its untouched plain object form. This
   * is useful if you need to access properties which are not (yet) wrapped.
   * Please open an issue or a pull request to wrap those properties ;)
   */
  unwrap(): RawProbeResult {
    return unwrapMap.get(this);
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

const unwrapMap = new WeakMap<any, any>();

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
