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
 * Runs `ffmpeg -version` and returns its output as a {@link Version}.
 * @param ffmpegPath Path to the ffmpeg executable. Defaults to `getFFmpegPath()`.
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

function parseLine(line: string, i = 4): string {
  return line.slice(i, line.slice(i).indexOf(' ') + i);
}

async function getLines(ffmpegPath: string, args: string[]) {
  const process = spawn(ffmpegPath, args, { stdio: 'pipe' });
  return (await read(process.stdout)).toString('utf-8').trim().split(/\r\n|[\r\n]/);
}

export async function getDemuxers(ffmpegPath = getFFmpegPath()): Promise<Set<string>> {
  const lines = await getLines(ffmpegPath, ['-demuxers']);
  const demuxers = new Set<string>();
  for (const line of lines.slice(4)) {
    demuxers.add(parseLine(line));
  }
  return demuxers;
}

export async function getMuxers(ffmpegPath = getFFmpegPath()): Promise<Set<string>> {
  const lines = await getLines(ffmpegPath, ['-muxers']);
  const muxers = new Set<string>();
  for (const line of lines.slice(4)) {
    muxers.add(parseLine(line));
  }
  return muxers;
}

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

export async function getCodecs(ffmpegPath = getFFmpegPath()): Promise<Codecs> {
  const codecs: Codecs = {
    video: new Set<string>(),
    audio: new Set<string>(),
    subtitle: new Set<string>(),
    data: new Set<string>(),
  };
  for (const [name, flags] of await getRawCodecs(ffmpegPath)) {
    if ((flags & VIDEO) !== 0) codecs.video.add(name);
    else if ((flags & AUDIO) !== 0) codecs.audio.add(name);
    else if ((flags & SUBTITLE) !== 0) codecs.subtitle.add(name);
    else if ((flags & DATA) !== 0) codecs.data.add(name);
  }
  return codecs;
}

export const DECODING = 1;
export const ENCODING = 2;
export const VIDEO = 4;
export const AUDIO = 8;
export const SUBTITLE = 16;
export const DATA = 32;
export const INTRA_ONLY = 64;
export const LOSSY = 128;
export const LOSSLESS = 256;

function getFlags(flagsString: string): number {
  let flags = 0;
  if (flagsString[0] === 'D') flags |= DECODING;
  if (flagsString[1] === 'E') flags |= ENCODING;
  switch (flagsString[2]) {
    case 'V':
      flags |= VIDEO;
      break;
    case 'A':
      flags |= AUDIO;
      break;
    case 'S':
      flags |= SUBTITLE;
      break;
    default:
      flags |= DATA;
      break;
  }
  if (flagsString[3] === 'I') flags |= INTRA_ONLY;
  if (flagsString[4] === 'L') flags |= LOSSY;
  if (flagsString[5] === 'S') flags |= LOSSLESS;
  return flags;
}

export async function getRawCodecs(ffmpegPath = getFFmpegPath()): Promise<Set<[string, number]>> {
  const lines = await getLines(ffmpegPath, ['-codecs']);
  const codecs = new Set<[string, number]>();
  for (const line of lines.slice(10)) {
    const name = parseLine(line, 8);
    const flags = getFlags(line.slice(1, 7));
    codecs.add([name, flags]);
  }
  return codecs;
}
