import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { BufferLike, end, isBufferLike, isWin32, write } from './utils';
import { createInterface as readlines } from 'readline';
import { toUint8Array } from './utils';
import { __asyncValues } from 'tslib';
import { getFFmpegPath } from './env';
import { getSockPath } from './sock';
import { Readable } from 'stream';

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
export type OutputDestination = string | { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; } | NodeJS.WritableStream;

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
  getArgs(): string[];
  isStream: boolean;
}

export interface FFmpegOutput {
  args(...args: string[]): this;
  getArgs(): string[];
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
  logLevel?: LogLevel;
  progress?: boolean;
}

export function ffmpeg(options?: FFmpegOptions): FFmpegCommand {
  return new Command(options);
}

export const MAX_BUFFER_LENGTH = 16383;

class Command implements FFmpegCommand {
  #args: string[] = ['-y'];
  #inputs: FFmpegInput[] = [];
  #outputs: FFmpegOutput[] = [];

  private logLevel: LogLevel;
  constructor(options: FFmpegOptions = {}) {
    this.logLevel = options.logLevel ?? LogLevel.Error;
    if (options.progress !== false)
      this.#args.push('-progress', 'pipe:2', '-nostats');
  }
  input(source: InputSource): FFmpegInput {
    return new Input(source);
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    return new Output(destinations);
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  spawn(ffmpegPath: string = getFFmpegPath()): FFmpegProcess {
    return new Process(ffmpegPath, this.getArgs(), null, null);
  }
  getArgs(): string[] {
    const inputs = ([] as string[]).concat(...this.#inputs.map(i => i.getArgs()));
    const outputs = ([] as string[]).concat(...this.#outputs.map(o => o.getArgs()));
    return [
      ...this.#args,
      '-v', this.logLevel.toString(),
      ...inputs,
      ...outputs,
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
    return progressGenerator(this.#process.stdout);
  }
  unwrap(): ChildProcess {
    return this.#process;
  }
}

const inputStreamMap = new WeakMap<Input, [string, NodeJS.ReadableStream]>();
class Input implements FFmpegInput {
  #resource: string;
  #args: string[] = [];

  isStream: boolean;
  constructor(source: InputSource) {
    if (typeof source === 'string') {
      this.#resource = source;
      this.isStream = false;
    } else if (isBufferLike(source)) {
      if (source.byteLength > MAX_BUFFER_LENGTH) {
        const sockPath = getSockPath();
        inputStreamMap.set(this, [sockPath, Readable.from([toUint8Array(source)])]);
        this.#resource = sockPath;
        this.isStream = true;
      } else {
        const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source);
        this.#resource = `data:application/octet-stream;base64,${buffer.toString('base64')}`;
        this.isStream = false;
      }
    } else {
      const sockPath = getSockPath();
      inputStreamMap.set(this, [sockPath, 'pipe' in source ? source : Readable.from(source)]);
      this.#resource = sockPath;
      this.isStream = true;
    }
  }
  getArgs(): string[] {
    return [
      ...this.#args,
      '-i', this.#resource,
    ];
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
}

const outputStreamMap = new WeakMap<Output, [string, AsyncGenerator<void, void, Uint8Array>[]]>();
class Output implements FFmpegOutput {
  #resource: string;
  #args: string[] = [];
  isStream: boolean;

  constructor(destinations: OutputDestination[]) {
    if (destinations.length === 0) {
      const sockPath = getSockPath();
      outputStreamMap.set(this, [sockPath, []]);
      this.#resource = sockPath;
      this.isStream = true;
    } else if (destinations.length === 1) {
      const dest = destinations[0];
      if (typeof dest === 'string') {
        this.#resource = dest;
        this.isStream = false;
      } else {
        const sockPath = getSockPath();
        outputStreamMap.set(this, [sockPath, [toOutputStream(dest)]]);
        this.#resource = sockPath;
        this.isStream = true;
      }
    } else {
      const resources: string[] = [];
      const streams: AsyncGenerator<void, void, Uint8Array>[] = [];
      const sockPath = getSockPath();
      this.isStream = false;
      for (const dest of destinations) {
        if (typeof dest === 'string') {
          resources.push(dest.replace(/[[|\]]/g, (char) => `\\${char}`));
        } else {
          if (!this.isStream) {
            outputStreamMap.set(this, [sockPath, streams]);
            resources.push(sockPath);
            this.isStream = true;
          }
          streams.push(toOutputStream(dest));
        }
      }
      this.#resource = `tee:${resources.join('|')}`;
    }
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    return [...this.#args, this.#resource];
  }
}

async function* progressGenerator(stream: NodeJS.ReadableStream) {
  let progress: Partial<Progress> = {};
  for await (const line of readlines(stream)) {
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

function toOutputStream(stream: NodeJS.WritableStream | { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; }): AsyncGenerator<void, void, Uint8Array> {
  if ('write' in stream) {
    return fromNodeStream(stream);
  } else {
    return fromIterable(stream);
  }
}

async function* fromNodeStream(stream: NodeJS.WritableStream): AsyncGenerator<void, void, Uint8Array> {
  try {
    while (true) {
      await write(stream, yield);
    }
  } finally {
    await end(stream);
  }
}

async function* fromIterable(stream: { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; }): AsyncGenerator<void, void, Uint8Array> {
  const it = __asyncValues(stream) as AsyncIterator<any, any, Uint8Array>;
  let r: IteratorResult<any>, e, m;
  try {
    while (r = await it.next(yield), !r.done);
  }
  catch (error) { e = { error }; }
  finally {
    try { if (r! && !r!.done && (m = it.return)) m.call(it); }
    // eslint-disable-next-line no-unsafe-finally
    finally { if (e) throw e.error; }
  }
}
