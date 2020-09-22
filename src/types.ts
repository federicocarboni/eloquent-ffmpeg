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
// https://github.com/FFmpeg/FFmpeg/blob/e71d73b09652f4fc96e512a7d6d4c2ab41860f27/fftools/ffprobe.c#L204
// TODO: this is a temporary solution

export type Tags = Map<string, string>;

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
  return type === 'video' ? new VideoStream(streamInfo) :
    type === 'audio' ? new AudioStream(streamInfo) :
    type === 'subtitle' ? new SubtitleStream(streamInfo) :
    new DataStream(streamInfo);
}

const privateMap = new WeakMap();


abstract class BaseStream {
  index: number;
  abstract type: string;
  codec: string;
  codecName: string;
  codecTag?: string;
  start: number;
  duration: number;
  bitrate: number;
  tags: Tags;

  constructor (info: any) {
    this.index = info.index >>> 0;
    this.codec = '' + info.codec_name;
    this.codecName = '' + info.codec_long_name;
    const tag = codecTag(info.codec_tag_string);
    if (tag) this.codecTag = tag;
    this.start = +info.start_time * 1000 | 0;
    this.duration = +info.duration * 1000 | 0;
    this.bitrate = int(info.bit_rate);
    this.tags = tags(info.tags);
  }
}

export class VideoStream extends BaseStream {
  type: 'video' = 'video';
  profile?: string;

  width: number;
  height: number;
  codedWidth: number;
  codedHeight: number;

  aspectRatio: string;
  pixelFormat: string;
  level: number;
  colorRange: string;
  colorSpace: string;
  colorTransfer: string;
  colorPrimaries: string;
  chromaLocation: string;
  fieldOrder: string;
  frameRate: number;
  avgFrameRate: number;
  bitsPerRawSample: number;

  constructor (info: any) {
    super(info);
    if (info.profile) this.profile = ('' + info.profile).toLowerCase();
    this.width = int(info.width);
    this.height = int(info.height);
    this.codedWidth = int(info.coded_width);
    this.codedHeight = int(info.coded_height);
    this.aspectRatio = '' + info.display_aspect_ratio;
    this.pixelFormat = '' + info.pixel_format;
    this.level = info.level >>> 0;
    this.colorRange = '' + info.color_range;
    this.colorSpace = '' + info.color_space;
    this.colorTransfer = '' + info.color_transfer;
    this.colorPrimaries = '' + info.color_primaries;
    this.chromaLocation = '' + info.chroma_location;
    this.fieldOrder = '' + info.field_order;
    this.frameRate = f64(info.frame_rate);
    this.avgFrameRate = f64(info.avg_frame_rate);
    this.bitsPerRawSample = info.bits_per_raw_sample >>> 0;
  }
}

export class AudioStream extends BaseStream {
  type: 'audio' = 'audio';
  profile?: string;
  sampleFormat: string;
  sampleRate: number;
  channels: number;
  channelLayout: string;
  bitsPerSample: number;
  constructor (info: any) {
    super(info);
    if (info.profile) this.profile = ('' + info.profile).toLowerCase();
    this.sampleFormat = '' + info.sample_fmt;
    this.sampleRate = info.sample_rate >>> 0;
    this.channels = info.channels >>> 0;
    this.channelLayout = '' + info.channel_layout;
    this.bitsPerSample = info.bits_per_sample >>> 0;
  }
}
export class SubtitleStream extends BaseStream {
  type: 'subtitle' = 'subtitle';
}

export class DataStream extends BaseStream {
  type: 'data' = 'data';
}

export type Stream = VideoStream | AudioStream | SubtitleStream | DataStream;

export class Chapter {
  id: number;
  start: number;
  end: number;
  tags: Tags;
  constructor (info: any) {
    this.id = info.id >>> 0;
    this.start = info.start * 1000000 | 0;
    this.end = info.end * 1000000 | 0;
    this.tags = tags(info.tags);
  }
}

export class ProbeResult {
  format: string; // TODO: this should be a union type

  // programs: number;
  streams: Stream[];
  chapters: Chapter[];

  bitrate: number;
  duration: number;
  start: number;

  score: number;

  tags: Tags;

  /** @internal */
  constructor (info: any) {
    privateMap.set(this, info);
    const formatInfo = info.format;
    this.format = '' + formatInfo.format_name;
    this.start = +formatInfo.start_time * 1000 | 0;
    this.duration = +formatInfo.duration * 1000 | 0;
    this.bitrate = int(formatInfo.bit_rate);
    this.score = formatInfo.probe_score | 0;
    this.tags = tags(formatInfo.tags);
    this.streams = Array.prototype.map.call(info.streams, toStream) as Stream[];
    this.chapters = Array.prototype.map.call(info.chapters, (info) => new Chapter(info)) as Chapter[];
  }

  unwrap() {
    return privateMap.get(this);
  }
}
