import { spawn } from 'child_process';
import { getFFmpegPath } from './env';
import { read } from './utils';

export interface Version {
  copyright: string;
  version: string;
  configuration: string[];
  libavutil: string;
  libavcodec: string;
  libavformat: string;
  libavdevice: string;
  libavfilter: string;
  libswscale: string;
  libswresample: string;
  libpostproc: string;
}
/**
 * Runs `ffmpeg -version` and returns its output as {@link Version}.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @example ```typescript
 * const versionInfo = await getVersion();
 * console.log(`Using ffmpeg version ${versionInfo.version}`);
 * ```
 */
export async function getVersion(ffmpegPath = getFFmpegPath()): Promise<Version> {
  const lines = await getLines(ffmpegPath, ['-version']);
  const split = lines[0].slice(15).split(' ');
  const version = split[0];
  const copyright = split.slice(1).join(' ');
  const configuration = lines[2].split(' ').slice(1);

  function getVersion(line: string) {
    const split = line.slice(15, 25).split('.');
    return split.map((s) => s.trim()).join('.');
  }

  const libavutil = getVersion(lines[3]);
  const libavcodec = getVersion(lines[4]);
  const libavformat = getVersion(lines[5]);
  const libavdevice = getVersion(lines[6]);
  const libavfilter = getVersion(lines[7]);
  const libswscale = getVersion(lines[8]);
  const libswresample = getVersion(lines[9]);
  const libpostproc = getVersion(lines[10]);

  return {
    copyright,
    version,
    configuration,
    libavutil,
    libavcodec,
    libavformat,
    libavdevice,
    libavfilter,
    libswscale,
    libswresample,
    libpostproc
  };
}
/**
 * Returns a set of all demuxers supported by ffmpeg. This is mostly useful
 * to check if reading a certain format is supported.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @example
 * ```typescript
 * const demuxers = await getDemuxers();
 * if (demuxers.has('mov')) {
 *   // mov can be used as an input format
 * }
 * ```
 */
export async function getDemuxers(ffmpegPath = getFFmpegPath()): Promise<Set<string>> {
  const lines = await getLines(ffmpegPath, ['-demuxers']);
  const demuxers = new Set<string>();
  for (const line of lines.slice(4)) {
    demuxers.add(parseLine(line));
  }
  return demuxers;
}
/**
 * Returns a set of all muxers supported by ffmpeg. This is mostly useful
 * to check if outputting a certain format is supported.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @example
 * ```typescript
 * const muxers = await getMuxers();
 * if (muxers.has('mov')) {
 *   // mov can be used as an output format
 * }
 * ```
 */
export async function getMuxers(ffmpegPath = getFFmpegPath()): Promise<Set<string>> {
  const lines = await getLines(ffmpegPath, ['-muxers']);
  const muxers = new Set<string>();
  for (const line of lines.slice(4)) {
    muxers.add(parseLine(line));
  }
  return muxers;
}
/**
 * Returns a set of all formats supported by ffmpeg. This is generally not very
 * useful, to check the compatibility for a certain format use {@link getMuxers}
 * for reading or {@link getDemuxers} for writing.
 * @param ffmpegPath Path to the ffmpeg executable.
 */
export async function getFormats(ffmpegPath = getFFmpegPath()): Promise<Set<string>> {
  const lines = await getLines(ffmpegPath, ['-formats']);
  const formats = new Set<string>();
  for (const line of lines.slice(4)) {
    formats.add(parseLine(line));
  }
  return formats;
}
export interface Codecs {
  video: Set<string>;
  audio: Set<string>;
  subtitle: Set<string>;
  data: Set<string>;
}
/**
 * Returns all the encoders supported by ffmpeg as {@link Codecs}. This is mostly
 * useful to check if ffmpeg supports encoding a certain codec.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @example ```typescript
 * const encoders = await getEncoders();
 * if (encoders.video.has('libx264')) {
 *   // libx264 can be used for encoding
 * }
 * ```
 */
export async function getEncoders(ffmpegPath = getFFmpegPath()): Promise<Codecs> {
  const lines = await getLines(ffmpegPath, ['-encoders']);
  return parseCodecs(lines, 1);
}
/**
 * Returns all the decoders supported by ffmpeg as {@link Codecs}. This is mostly
 * useful to check if ffmpeg supports decoding a certain codec.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @example ```typescript
 * const decoders = await getDecoders();
 * if (decoders.video.has('h264')) {
 *   // h264 can be used for decoding
 * }
 * ```
 */
export async function getDecoders(ffmpegPath = getFFmpegPath()): Promise<Codecs> {
  const lines = await getLines(ffmpegPath, ['-decoders']);
  return parseCodecs(lines, 1);
}
/**
 * Runs `ffmpeg -codecs` and returns its output as {@link Codecs}. This is generally not
 * very useful, if you need to check the compatibility for a certain encoder or decoder use
 * {@link getEncoders} or {@link getDecoders}.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @returns All codecs supported by ffmpeg.
 */
export async function getCodecs(ffmpegPath = getFFmpegPath()): Promise<Codecs> {
  const lines = await getLines(ffmpegPath, ['-codecs']);
  return parseCodecs(lines, 3);
}
/**
 * Runs `ffmpeg -pix_fmts` and returns its output as a set. This can be used to
 * check for compatibility or show a list of available formats to the user.
 * @param ffmpegPath Path to the ffmpeg executable.
 * @example ```typescript
 * const pixelFormats = await getPixelFormats();
 * if (pixelFormats.has('yuv420p')) {
 *   // yuv420p is supported
 * }
 * ```
 */
export async function getPixelFormats(ffmpegPath = getFFmpegPath()): Promise<Set<string>> {
  const lines = await getLines(ffmpegPath, ['-pix_fmts']);
  const pixelFormats = new Set<string>();
  for (const line of lines.slice(8)) {
    pixelFormats.add(parseLine(line, 6));
  }
  return pixelFormats;
}

function parseCodecs(lines: string[], flag: number) {
  const codecs: Codecs = {
    video: new Set<string>(),
    audio: new Set<string>(),
    subtitle: new Set<string>(),
    data: new Set<string>(),
  };
  for (const line of lines.slice(10)) {
    const name = parseLine(line, 8);
    switch (line[flag]) {
      case 'V':
        codecs.video.add(name);
        break;
      case 'A':
        codecs.audio.add(name);
        break;
      case 'S':
        codecs.subtitle.add(name);
        break;
      case 'D':
        codecs.data.add(name);
    }
  }
  return codecs;
}

function parseLine(line: string, i = 4): string {
  return line.slice(i, line.slice(i).indexOf(' ') + i);
}

async function getLines(ffmpegPath: string, args: string[]) {
  const process = spawn(ffmpegPath, args, { stdio: 'pipe' });
  return (await read(process.stdout)).toString('utf-8').trim().split(/\r\n|[\r\n]/);
}
