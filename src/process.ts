import type { FFmpegLogger, FFmpegProcess, Logs, Progress, SpawnOptions } from './types';

import * as childProcess from 'child_process';
import * as readline from 'readline';

import { stringifyObjectColonSeparated } from './string';
import { exited, pause, resume, write } from './utils';
import { parseLogs } from './parse_logs';

// Turn an ffmpeg log level into its numeric representation.
const logLevelToN = Object.assign(Object.create(null) as {}, {
  quiet: -8,
  panic: 0,
  fatal: 8,
  error: 16,
  warning: 24,
  info: 32,
  verbose: 40,
  debug: 48,
  trace: 56,
} as const);

// Match the `[level]` segment in a line logged by ffmpeg.
const LEVEL_MATCH = /\[(trace|debug|verbose|info|warning|error|fatal)\]/;
// Match progress key and value in a progress line.
const PROGRESS_LINE_MATCH = /^(frame|fps|bitrate|total_size|out_time_us|dup_frames|drop_frames|speed|progress)=(.*?)$/;

class Process implements FFmpegProcess {
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
      const stderr = cp.stderr;
      if (stderr === null || !stderr.readable)
        throw new TypeError('Cannot parse logs, stderr is not readable');
      const rl = readline.createInterface(stderr);
      if (logger)
        rl.on('line', (line) => {
          const match = line.match(LEVEL_MATCH);
          if (match !== null) {
            const level = match[1] as keyof FFmpegLogger;
            logger[level]?.(line);
          }
        });
      if (doParseLogs) {
        this.logs = parseLogs(rl)
          .finally(() => {
            // TODO: temporary solution
            rl.resume();
          });
      }
    }
  }
  logs: Promise<Logs> | undefined = void 0;
  #cp: childProcess.ChildProcess;
  #exited = false;

  async *progress(): AsyncGenerator<Progress, void, void> {
    const stdout = this.#cp.stdout;
    if (this.#exited || stdout === null || !stdout.readable)
      throw new TypeError('Cannot parse progress, stdout not readable');
    let frames: number | undefined;
    let fps: number | undefined;
    let bitrate: number | undefined;
    let size: number | undefined;
    let time: number | undefined;
    let framesDuped: number | undefined;
    let framesDropped: number | undefined;
    let speed: number | undefined;
    for await (const line of readline.createInterface(stdout)) {
      const match = line.match(PROGRESS_LINE_MATCH);
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
          size = parseInt(value, 10);
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
          yield { frames, fps, bitrate, size, time, framesDuped, framesDropped, speed };
          frames = fps = bitrate = size = time = framesDuped = framesDropped = speed = void 0;
          // Return on `progress=end`, which indicates that there will be no further progress logs.
          if (value === 'end')
            return;
          break;
      }
    }
  }
  async abort() {
    const stdin = this.#cp.stdin;
    if (this.#exited || stdin === null || !stdin.writable)
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
        ? 'FFmpeg exited prematurely, was it killed? https://git.io/JTqA9#ffmpeg-exited-prematurely'
        : `FFmpeg exited with code ${cp.exitCode} https://git.io/JTqA9#ffmpeg-exited-with-code-x`;
      throw Object.assign(new Error(message), {
        ffmpegPath: this.ffmpegPath,
        args: this.args,
        exitCode: cp.exitCode,
      });
    }
  }
  unwrap(): childProcess.ChildProcess {
    return this.#cp;
  }
}

/**
 * Start an FFmpeg process with the given arguments.
 * @param args - The arguments to spawn FFmpeg with.
 * @param options -
 * @public
 */
export function spawn(args: string[], options: SpawnOptions = {}): FFmpegProcess {
  const {
    ffmpegPath = 'ffmpeg',
    spawnOptions,
    report = false,
    logger = false,
    parseLogs = false,
  } = options;
  const cpSpawnOptions: childProcess.SpawnOptions = {
    stdio: ['pipe', 'pipe', logger || parseLogs ? 'pipe' : 'ignore'],
    ...spawnOptions,
  };
  if (report) {
    // FFREPORT can be either a ':' separated list of key-value pairs, which
    // takes `file` and `level` as keys, or any non-empty string which enables
    // reporting with default options. If no options are specified the string
    // `true` is used.
    // https://ffmpeg.org/ffmpeg-all.html#Generic-options
    const FFREPORT = report !== true && stringifyObjectColonSeparated({
      file: report.file,
      level: logLevelToN[report.level!],
    }) || 'true';
    cpSpawnOptions.env = {
      // Merge with previous options or the current environment.
      ...(cpSpawnOptions.env ?? process.env),
      FFREPORT,
    };
  }
  const cp = childProcess.spawn(ffmpegPath, args, cpSpawnOptions);
  return new Process(cp, ffmpegPath, args, logger, parseLogs);
}
