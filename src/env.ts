import { existsSync, lstatSync } from 'fs';
import { resolve } from 'path';

export let ffprobePath: string | undefined;
export let ffmpegPath: string | undefined;

export function setFFmpegPath(path: string) {
  ffmpegPath = path;
}
export function setFFprobePath(path: string) {
  ffprobePath = path;
}

const ext = process.platform === 'win32' ? '.exe' : '';
const env = process.env;

const has = (o: object, p: PropertyKey) => Object.prototype.hasOwnProperty.call(o, p);

if (has(env, 'FFPROBE_PATH')) {
  const { FFPROBE_PATH } = env;

  if (existsSync(FFPROBE_PATH!) && lstatSync(FFPROBE_PATH!).isFile()) {
    ffprobePath = resolve(FFPROBE_PATH!);
  }
}

if (has(env, 'FFMPEG_PATH')) {
  const { FFMPEG_PATH } = env;

  if (existsSync(FFMPEG_PATH!)) {
    const stat = lstatSync(FFMPEG_PATH!);
    if (stat.isDirectory()) {
      ffmpegPath = resolve(FFMPEG_PATH!, 'ffmpeg' + ext);
      ffprobePath = resolve(FFMPEG_PATH!, 'ffprobe' + ext);
    } else if (stat.isFile()) {
      ffmpegPath = resolve(FFMPEG_PATH!);
    }
  }
}
