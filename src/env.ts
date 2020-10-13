import { existsSync, lstatSync } from 'fs';
import { resolve } from 'path';

const { FFMPEG_PATH, FFPROBE_PATH } = process.env;

let ffmpegPath: string | undefined = FFMPEG_PATH ? resolvePath(FFMPEG_PATH) : void 0;
/**
 * Manually override the default ffmpeg path.
 * @param path - Path to the ffmpeg executable. Relative paths CAN be used.
 * @throws `TypeError` if the given `path` is not a file.
 * @public
 */
export function setFFmpegPath(path: string): void {
  const newPath = resolvePath(path);
  if (newPath === void 0)
    throw new TypeError(`'${path}' is not a file`);
  ffmpegPath = newPath;
}
/**
 * @returns The absolute path to the default ffmpeg path. Defaults to `process.env.FFMPEG_PATH`.
 * @throws `TypeError` if the default path is `undefined`.
 * @public
 */
export function getFFmpegPath(): string {
  if (ffmpegPath === void 0)
    throw new TypeError('Cannot find ffmpeg, make sure to set FFMPEG_PATH or call setFFmpegPath()');
  return ffmpegPath;
}

let ffprobePath: string | undefined = FFPROBE_PATH ? resolvePath(FFPROBE_PATH) : void 0;
/**
 * Manually override the default ffprobe path.
 * @param path - Path to the ffprobe executable. Relative paths CAN be used.
 * @throws `TypeError` if the `path` is not a file.
 * @public
 */
export function setFFprobePath(path: string): void {
  const newPath = resolvePath(path);
  if (newPath === void 0)
    throw new TypeError(`'${path}' is not a file`);
  ffprobePath = newPath;
}
/**
 * @returns - The absolute path to the default ffprobe path. Defaults to `process.env.FFPROBE_PATH`.
 * @throws `TypeError` if the default path is `undefined`.
 * @public
 */
export function getFFprobePath(): string {
  if (ffprobePath === void 0)
    throw new TypeError('Cannot find ffprobe, make sure to set FFPROBE_PATH or call setFFprobePath()');
  return ffprobePath;
}

function resolvePath(path: string): string | undefined {
  const fullpath = resolve(path);
  if (existsSync(fullpath) && lstatSync(fullpath).isFile())
    return fullpath;
  return void 0;
}
