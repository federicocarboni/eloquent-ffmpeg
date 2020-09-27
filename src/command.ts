import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createInterface as readlines } from 'readline';
import { toUint8Array } from '../lib/utils';
import { getFFmpegPath } from './env';
import { BufferLike, isWin32 } from './utils';

export enum LogLevel {
  Quiet = 'quiet',
  Panic = 'panic',
  Fatal = 'fatal',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Verbose = 'verbose',
  Debug = 'debug',
  Trace = 'trace',
}

export type InputSource = string | BufferLike | AsyncIterable<BufferLike> | Iterable<BufferLike> | NodeJS.ReadableStream;
export type OutputDestination = string | null | { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; } | NodeJS.WritableStream;

export interface Progress {
  frames: number;
  fps: number;
  bitrate: number;
  size: number;
  time: number;
  framesDuped: number;
  framesDropped: number;
  speed: number;
}

export interface FFmpegInput {
  args(...args: string[]): this;
  isStream: boolean;
}

export interface FFmpegOutput {
  args(...args: string[]): this;
  isStream: boolean;
}

export interface FFmpegProcess {
  progress(): AsyncGenerator<Progress, void, void>;
  pid: number;
  args: string[];
  ffmpegPath: string;
  kill(signal?: NodeJS.Signals | number): boolean;
  wait(): Promise<void>;
  pause(): boolean;
  resume(): boolean;
  unwrap(): ChildProcess;
}

export interface FFmpegCommand {
  input(source: InputSource): FFmpegInput;
  output(...destinations: OutputDestination[]): FFmpegOutput;
  args(...args: string[]): this;

  spawn(ffmpegPath?: string): FFmpegProcess;
  getArgs(): string[];
}

export interface FFmpegOptions {
  logLevel: LogLevel;
}

class Command implements FFmpegCommand {
  #args: string[] = ['-progress', 'pipe:2', '-nostats'];
  #inputs;
  #outputs;

  private logLevel: LogLevel;
  constructor(options?: FFmpegOptions) {
    this.logLevel = options?.logLevel ?? LogLevel.Error;
  }
  input(source: InputSource): FFmpegInput {
    throw new Error('Method not implemented.');
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    throw new Error('Method not implemented.');
  }
  args(...args: string[]): this {
    throw new Error('Method not implemented.');
  }
  spawn(ffmpegPath: string = getFFmpegPath()): FFmpegProcess {
    // throw new Error('Method not implemented.');
    return new Process(ffmpegPath, this.getArgs(), null as any, null as any);
  }
  getArgs(): string[] {
    return [
      ...this.#args,
      '-v', this.logLevel.toString(),
    ];
  }
}

class Process implements FFmpegProcess {
  #process: ChildProcessWithoutNullStreams;
  constructor(public ffmpegPath: string, public args: string[], inputStream: NodeJS.ReadableStream | null, outputStream: NodeJS.WritableStream | AsyncGenerator<void, void, Uint8Array> | null) {
    this.#process = spawnProcess(ffmpegPath, args, inputStream, outputStream);
  }
  get pid(): number {
    return this.#process.pid;
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    return this.#process.kill(signal);
  }
  pause(): boolean {
    if (isWin32) throw new TypeError('pause() cannot be used on Windows');
    return this.kill('SIGSTOP');
  }
  resume(): boolean {
    if (isWin32) throw new TypeError('resume() cannot be used on Windows');
    return this.kill('SIGCONT');
  }
  wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(); // TODO: add exception
      });
    });
  }
  progress(): AsyncGenerator<Progress, void, void> {
    return progressGenerator(this.#process);
  }
  unwrap(): ChildProcess {
    return this.#process;
  }
}

async function* progressGenerator(process: ChildProcess) {
  let progress: Partial<Progress> = {};
  for await (const line of readlines(process.stderr!)) {
    try {
      const [part1, part2] = line.split('=');
      const key = part1.trim();
      const value = part2.trim();
      switch (key) {
        case 'frame':
          progress.frames = +value >>> 0;
          break;
        case 'fps':
          progress.fps = +value || 0;
          break;
        case 'bitrate':
          progress.bitrate = +value;
          break;
        case 'total_size':
          progress.size = +value >>> 0;
          break;
        case 'out_time_us':
          progress.time = +value * 1000 >>> 0;
          break;
        case 'dup_frames':
          progress.framesDuped = +value >>> 0;
          break;
        case 'drop_frames':
          progress.framesDropped = +value >>> 0;
          break;
        case 'speed':
          progress.speed = +value.slice(0, value.length - 1);
          break;
        case 'progress':
          yield progress as Progress;
          if (value === 'end')
            return;
          progress = {};
      }
    } catch {
      //
    }
  }
}

function spawnProcess(ffmpegPath: string, args: string[], inputStream: NodeJS.ReadableStream | null, outputStream: NodeJS.WritableStream | AsyncGenerator<void, void, Uint8Array> | null): ChildProcessWithoutNullStreams {
  const process = spawn(ffmpegPath, args, { stdio: 'pipe' });
  const { stdin, stdout } = process;
  if (inputStream !== null)
    inputStream.pipe(stdin);
  if (outputStream !== null) {
    if ('write' in outputStream) {
      stdout.pipe(outputStream);
    } else {
      pipeToGenerator(stdout, outputStream);
    }
  }
  return process;
}

async function pipeToGenerator(input: NodeJS.ReadableStream, output: AsyncGenerator<void, void, Uint8Array>) {
  for await (const chunk of input) await output.next(toUint8Array(chunk as Buffer));
}
