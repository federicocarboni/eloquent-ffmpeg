import type { ChildProcess, ChildProcessWithoutNullStreams } from 'child_process';
import type { FFmpegProcess, Progress, SpawnOptions } from './types';

import * as childProcess from 'child_process';
import * as readline from 'readline';

import { exited, pause, resume, write } from './utils';

/**
 * Start an FFmpeg process with the given arguments.
 * @param args - The arguments to spawn FFmpeg with.
 * @param options - `logger` and `report` are not currently supported by this function.
 * @public
 */
export function spawn(args: string[], options: SpawnOptions = {}): FFmpegProcess {
  const { ffmpegPath = 'ffmpeg', spawnOptions } = options;
  const cp = childProcess.spawn(ffmpegPath, args, {
    stdio: 'pipe',
    ...spawnOptions,
  });
  return new Process(cp, ffmpegPath, args);
}

const PROGRESS_LINE_REGEXP = /^(frame|fps|bitrate|total_size|out_time_us|dup_frames|drop_frames|speed|progress)=([\u0020-\u00FF]*?)$/;

/** @internal */
export class Process implements FFmpegProcess {
  constructor(
    ffmpeg: ChildProcessWithoutNullStreams,
    public readonly ffmpegPath: string,
    public readonly args: readonly string[]
  ) {
    this.#ffmpeg = ffmpeg;
    const onExit = () => {
      ffmpeg.off('exit', onExit);
      ffmpeg.off('error', onExit);
      this.#exited = true;
    };
    ffmpeg.on('exit', onExit);
    ffmpeg.on('error', onExit);
  }
  #ffmpeg: ChildProcessWithoutNullStreams;
  #exited = false;

  async *progress(): AsyncGenerator<Progress, void, void> {
    const stdout = this.#ffmpeg.stdout;
    if (this.#exited || !stdout.readable)
      throw new TypeError('Cannot parse progress, stdout not readable');
    let frames: number | undefined;
    let fps: number | undefined;
    let bitrate: number | undefined;
    let bytes: number | undefined;
    let time: number | undefined;
    let framesDuped: number | undefined;
    let framesDropped: number | undefined;
    let speed: number | undefined;
    for await (const line of readline.createInterface(stdout)) {
      const match = line.match(PROGRESS_LINE_REGEXP);
      if (match === null)
        continue;
      const [, key, value] = match;
      if (value === 'N/A')
        continue;
      // https://github.com/FFmpeg/FFmpeg/blob/bea7c513079a811512da378730366d80f8155f2d/fftools/ffmpeg.c#L1699
      switch (key) {
        case 'frame':
          frames = parseInt(value, 10);
          break;
        case 'fps':
          fps = parseFloat(value);
          break;
        case 'bitrate':
          bitrate = parseFloat(value);
          break;
        case 'total_size':
          bytes = parseInt(value, 10);
          break;
        case 'out_time_us':
          // Remove the last three digits to quickly convert from μs to ms.
          // time = Math.round(parseInt(value, 10) / 1000);
          time = parseInt(value.slice(0, -3), 10);
          break;
        case 'dup_frames':
          framesDuped = parseInt(value, 10);
          break;
        case 'drop_frames':
          framesDropped = parseInt(value, 10);
          break;
        case 'speed':
          speed = parseFloat(value);
          break;
        case 'progress':
          yield { frames, fps, bitrate, bytes, time, framesDuped, framesDropped, speed } as Progress;
          // Return on `progress=end`, which indicates that there will be no further progress logs.
          if (value === 'end')
            return;
          frames = fps = bitrate = bytes = time = framesDuped = framesDropped = speed = void 0;
          break;
      }
    }
  }
  async abort() {
    const stdin = this.#ffmpeg.stdin;
    if (this.#exited || !stdin.writable)
      throw new TypeError('Cannot abort FFmpeg process, stdin not writable');
    await write(stdin, new Uint8Array([113, 10])); // => writes 'q\n'
    return await this.complete();
  }
  pause() {
    if (this.#exited)
      return false;
    return pause(this.#ffmpeg);
  }
  resume() {
    if (this.#exited)
      return false;
    return resume(this.#ffmpeg);
  }
  async complete() {
    const ffmpeg = this.#ffmpeg;
    if (!this.#exited)
      await exited(ffmpeg);
    if (ffmpeg.exitCode !== 0) {
      const message = ffmpeg.exitCode === null
        ? 'FFmpeg exited prematurely, was it killed?'
        : `FFmpeg exited with code ${ffmpeg.exitCode}`;
      throw Object.assign(new Error(message), {
        ffmpegPath: this.ffmpegPath,
        args: this.args
      });
    }
  }
  unwrap(): ChildProcess {
    return this.#ffmpeg;
  }
}
