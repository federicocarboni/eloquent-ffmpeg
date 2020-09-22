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
  const ffmpeg = spawn(ffmpegPath, ['-version'], { stdio: 'pipe' });
  const stdout = (await read(ffmpeg.stdout)).toString('utf-8');
  const lines = stdout.split(/\r\n|[\r\n]/);
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

// export function getFormats(ffmpegPath = getFFmpegPath(), muxOnly = true)[] {

// }
