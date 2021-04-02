import type { FFmpegLogger, FFmpegProcess, Progress, SpawnOptions } from './types';

import * as childProcess from 'child_process';
import * as readline from 'readline';

import { exited, pause, resume, write } from './utils';
import { Logs, parseLogs } from './parse_logs';

/**
 * Start an FFmpeg process with the given arguments.
 * @param args - The arguments to spawn FFmpeg with.
 * @param options - `logger` and `report` are not currently supported by this function.
 * @public
 */
export function spawn(args: string[], options: SpawnOptions = {}): FFmpegProcess {
  const {
    ffmpegPath = 'ffmpeg',
    spawnOptions,
    logger = false,
    parseLogs = false,
  } = options;
  const cp = childProcess.spawn(ffmpegPath, args, {
    stdio: ['pipe', 'pipe', logger || parseLogs ? 'pipe' : 'ignore'],
    ...spawnOptions,
  });
  return new Process(cp, ffmpegPath, args, logger, parseLogs);
}

// Match the `[level]` segment inside an ffmpeg line.
const LEVEL_REGEXP = /\[(trace|debug|verbose|info|warning|error|fatal)\]/;

const PROGRESS_LINE_REGEXP = /^(frame|fps|bitrate|total_size|out_time_us|dup_frames|drop_frames|speed|progress)=([\u0020-\u00FF]*?)$/;

/** @internal */
export class Process implements FFmpegProcess {
  constructor(
    cp: childProcess.ChildProcess,
    public readonly ffmpegPath: string,
    public readonly args: readonly string[],
    logger: FFmpegLogger | false,
    doParseLogs: boolean,
  ) {
    this.#cp = cp;
    const onExit = () => {
      cp.off('exit', onExit);
      cp.off('error', onExit);
      this.#exited = true;
    };
    cp.on('exit', onExit);
    cp.on('error', onExit);
    if (logger || doParseLogs) {
      if (cp.stderr === null)
        throw new TypeError('Cannot parse logs');
      const stderr = readline.createInterface(cp.stderr);
      if (logger) {
        stderr.on('line', (line: string) => {
          const match = line.match(LEVEL_REGEXP);
          if (match !== null) {
            const level = match[1] as keyof FFmpegLogger;
            logger[level]?.(line);
          }
        });
      }
      if (doParseLogs) {
        this._logs = parseLogs(stderr);
      }
    }
  }
  #cp: childProcess.ChildProcess;
  #exited = false;
  _logs: Promise<Logs> | undefined = void 0;

  get logs() {
    return this._logs;
  }
  async *progress(): AsyncGenerator<Progress, void, void> {
    const stdout = this.#cp.stdout;
    if (this.#exited || stdout === null || !stdout.readable)
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
    const stdin = this.#cp.stdin!;
    if (this.#exited || !stdin.writable)
      throw new TypeError('Cannot abort FFmpeg process, stdin not writable');
    await write(stdin, new Uint8Array([113, 10])); // => writes 'q\n'
    return await this.complete();
  }
  pause() {
    if (this.#exited)
      return false;
    return pause(this.#cp);
  }
  resume() {
    if (this.#exited)
      return false;
    return resume(this.#cp);
  }
  async complete() {
    const cp = this.#cp;
    if (!this.#exited)
      await exited(cp);
    if (cp.exitCode !== 0) {
      const message = cp.exitCode === null
        ? 'FFmpeg exited prematurely, was it killed?'
        : `FFmpeg exited with code ${cp.exitCode}`;
      throw Object.assign(new Error(message), {
        ffmpegPath: this.ffmpegPath,
        args: this.args,
      });
    }
  }
  unwrap(): childProcess.ChildProcess {
    return this.#cp;
  }
}
