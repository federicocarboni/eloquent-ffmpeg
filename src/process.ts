import {
  ChildProcess, ChildProcessWithoutNullStreams,
  spawn as spawnChildProcess
} from 'child_process';
import { createInterface as readlines } from 'readline';
import { pause, resume, write } from './utils';
import { FFmpegError } from './errors';
import type { SpawnOptions } from './command';

/** @public */
export interface Progress {
  frames: number;
  fps: number;
  bitrate: number;
  bytes: number;
  time: number;
  framesDuped: number;
  framesDropped: number;
  speed: number;
}

/** @public */
export interface FFmpegProcess {
  /**
   * **UNSTABLE:** Deprecated, not for use in new projects.
   *
   * @deprecated Use `FFmpegProcess.unwrap().pid` instead.
   *
   * Returns the process identifier (PID) of the process.
   */
  readonly pid: number;
  /**
   * The command line arguments used to spawn the process.
   */
  readonly args: readonly string[];
  /**
   * Path of the running ffmpeg executable.
   */
  readonly ffmpegPath: string;
  /**
   * Returns an AsyncGenerator representing the real-time progress of the conversion.
   * @example
   * ```ts
   * const process = await cmd.spawn();
   * for await (const progress of process.progress()) {
   *   console.log('Speed:', progress.speed);
   * }
   * ```
   * Using NodeJS Streams:
   * ```ts
   * const process = await cmd.spawn();
   * const progressStream = Readable.from(process.progress());
   * progressStream.on('data', (progress) => {
   *   console.log('Speed:', progress.speed);
   * });
   * ```
   */
  progress(): AsyncGenerator<Progress, void, void>;
  /**
   * Returns a Promise which resolves when the process exits, or rejects when the
   * process exits with a non-zero status code.
   * @example
   * ```ts
   * const process = cmd.spawn();
   * await process.complete();
   * console.log('Conversion complete!');
   * ```
   * To handle errors:
   * ```ts
   * const process = await cmd.spawn();
   * try {
   *   await process.complete();
   *   console.log('Conversion complete!');
   * } catch (e) {
   *   console.error('Conversion failed!', error);
   * }
   * ```
   */
  complete(): Promise<void>;
  /**
   * Aborts the conversion allowing FFmpeg to finish the generated files correctly.
   * This waits for FFmpeg to exit but doesn't wait guarantee that FFmpeg will succeed,
   * you should handle any possible errors.
   */
  abort(): Promise<void>;
  /**
   * Returns the underlying NodeJS' ChildProcess instance.
   */
  unwrap(): ChildProcess;
  /**
   * **UNSTABLE**: Deprecated, not for use in new projects.
   *
   * Sends a signal to the running process.
   * See {@link https://nodejs.org/api/child_process.html#child_process_subprocess_kill_signal}
   *
   * @deprecated To terminate the conversion use {@link FFmpegProcess.abort}, to pause and resume
   * the process use {@link FFmpegProcess.pause} or {@link FFmpegProcess.resume}. If you really
   * have to send a signal to the process use `process.unwrap().kill(signal)`.
   *
   * @param signal - The signal to send.
   */
  kill(signal?: NodeJS.Signals | number): boolean;
  /**
   * Pauses the conversion, returns `true` if the operation succeeds, `false` otherwise.
   */
  pause(): boolean;
  /**
   * Resumes the conversion, returns `true` if the operation succeeds, `false` otherwise.
   */
  resume(): boolean;
}

/**
 * Start an FFmpeg process with the given arguments.
 * @param args - The arguments to spawn FFmpeg with.
 * @param ffmpegPath - Path to the ffmpeg executable. Defaults to `getFFmpegPath()`.
 * @public
 */
export function spawn(args: string[], options: SpawnOptions = {}): FFmpegProcess {
  const {
    ffmpegPath = 'ffmpeg',
    spawnOptions = {},
  } = options;
  const process = spawnChildProcess(ffmpegPath, args, {
    stdio: 'pipe',
    ...spawnOptions,
  }) as ChildProcessWithoutNullStreams;
  return new Process(process, args, ffmpegPath);
}

/** @internal */
export class Process implements FFmpegProcess {
  constructor(ffmpeg: ChildProcessWithoutNullStreams, args: string[], ffmpegPath: string) {
    this.#ffmpeg = ffmpeg;
    this.args = args;
    this.ffmpegPath = ffmpegPath;
    const onExit = () => {
      this.#exited = true;
      ffmpeg.off('exit', onExit);
      ffmpeg.off('error', onExit);
    };
    ffmpeg.on('exit', onExit);
    ffmpeg.on('error', onExit);
  }
  #ffmpeg: ChildProcessWithoutNullStreams;
  #exited = false;
  args: readonly string[];
  ffmpegPath: string;
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
  complete() {
    return new Promise<void>((resolve, reject) => {
      const ffmpeg = this.#ffmpeg;
      const complete = () => ffmpeg.exitCode === 0 ? resolve() : reject(
        new FFmpegError(`FFmpeg exited with code ${ffmpeg.exitCode}`));
      if (this.#exited) {
        complete();
      } else {
        const onExit = () => {
          ffmpeg.off('exit', onExit);
          ffmpeg.off('error', onExit);
          complete();
        };
        ffmpeg.on('exit', onExit);
        ffmpeg.on('error', onExit);
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
