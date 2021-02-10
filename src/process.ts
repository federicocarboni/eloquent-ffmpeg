import { ChildProcessWithoutNullStreams, spawn as spawnChildProcess } from 'child_process';
import { createInterface as readlines } from 'readline';
import { FFmpegProcess, Progress, SpawnOptions } from './types';
import { pause, resume, write } from './utils';

/**
 * Start an FFmpeg process with the given arguments.
 * @param args - The arguments to spawn FFmpeg with.
 * @param options - `logger` and `report` are not currently supported by this function.
 * @public
 */
export function spawn(args: string[], options: SpawnOptions = {}): FFmpegProcess {
  const { ffmpegPath = 'ffmpeg', spawnOptions = {} } = options;
  const ffmpeg = spawnChildProcess(ffmpegPath, args, {
    stdio: 'pipe',
    ...spawnOptions,
  }) as ChildProcessWithoutNullStreams;
  return new Process(ffmpeg, args, ffmpegPath);
}

/** @internal */
export class Process implements FFmpegProcess {
  constructor(
    ffmpeg: ChildProcessWithoutNullStreams,
    public readonly args: readonly string[],
    public readonly ffmpegPath: string
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

  async *progress() {
    let progress: Partial<Progress> = {};
    for await (const line of readlines(this.#ffmpeg.stdout)) {
      try {
        const [key, rawValue] = line.split('=');
        const value = rawValue.trim();
        switch (key.trim()) {
          case 'frame':
            progress.frames = parseInt(value, 10) >>> 0;
            break;
          case 'fps':
            progress.fps = parseFloat(value) || 0;
            break;
          case 'bitrate':
            progress.bitrate = parseFloat(value) || 0;
            break;
          case 'total_size':
            progress.bytes = parseInt(value, 10) >>> 0;
            break;
          case 'out_time_us':
            progress.time = parseInt(value, 10) / 1000 >>> 0;
            break;
          case 'dup_frames':
            progress.framesDuped = parseInt(value, 10) >>> 0;
            break;
          case 'drop_frames':
            progress.framesDropped = parseInt(value, 10) >>> 0;
            break;
          case 'speed':
            progress.speed = parseFloat(value) || 0;
            break;
          case 'progress':
            yield progress as Progress;
            if (value === 'end')
              return;
            progress = {};
            break;
        }
      } catch {
        //
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
    return await new Promise<void>((resolve, reject) => {
      const ffmpeg = this.#ffmpeg;
      const complete = () => {
        if (ffmpeg.exitCode === 0) {
          resolve();
        } else {
          const message = ffmpeg.exitCode === null
            ? 'FFmpeg exited prematurely, was it killed?'
            : `FFmpeg exited with code ${ffmpeg.exitCode}`;
          reject(Object.assign(new Error(message), {
            ffmpegPath: this.ffmpegPath,
            args: this.args
          }));
        }
      };
      if (this.#exited) {
        complete();
      } else {
        const unlisten = () => {
          ffmpeg.off('exit', onExit);
          ffmpeg.off('error', onError);
        };
        const onError = (error: Error) => {
          unlisten();
          // Forward the error from Node.js child process.
          Error.captureStackTrace?.(error);
          reject(error);
        };
        const onExit = () => {
          unlisten();
          complete();
        };
        ffmpeg.on('exit', onExit);
        ffmpeg.on('error', onError);
      }
    });
  }
  unwrap() {
    return this.#ffmpeg;
  }
  get pid() {
    return this.#ffmpeg.pid;
  }
  kill(signal?: number | NodeJS.Signals) {
    return this.#ffmpeg.kill(signal);
  }
}
