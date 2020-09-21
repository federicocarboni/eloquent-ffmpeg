import { resolve } from 'path';

const { FFMPEG_PATH, FFPROBE_PATH } = process.env;

let ffmpegPath: string | undefined = FFMPEG_PATH ? resolve(FFMPEG_PATH) : void 0;

export function setFFmpegPath(path: string): void {
  ffmpegPath = '' + path;
}
export function getFFmpegPath(): string {
  if (!ffmpegPath) throw new TypeError();
  return ffmpegPath;
}

let ffprobePath: string | undefined = FFPROBE_PATH ? resolve(FFPROBE_PATH) : void 0;

export function setFFprobePath(path: string): void {
  ffprobePath = path;
}
export function getFFprobePath(): string {
  if (!ffprobePath) throw new TypeError();
  return ffprobePath;
}
