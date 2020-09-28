import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { BufferLike, end, isBufferLike, isWin32, write } from './utils';
import { createInterface as readlines } from 'readline';
import { getSocketServer, getSockPath } from './sock';
import { toUint8Array } from './utils';
// import { __asyncValues } from 'tslib';
import { getFFmpegPath } from './env';
import { __asyncValues } from 'tslib';
import { Server } from 'net';

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

  spawn(ffmpegPath?: string): Promise<FFmpegProcess>;
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
  #inputs: Input[] = [];
  #outputs: Output[] = [];

  private logLevel: LogLevel;
  constructor(options: FFmpegOptions = {}) {
    this.logLevel = options.logLevel ?? LogLevel.Error;
    if (options.progress !== false)
      this.#args.push('-progress', 'pipe:2', '-nostats');
  }
  input(source: InputSource): FFmpegInput {
    const input = new Input(source);
    this.#inputs.push(input);
    return input;
  }
  output(...destinations: OutputDestination[]): FFmpegOutput {
    const output = new Output(destinations);
    this.#outputs.push(output);
    return output;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  async spawn(ffmpegPath: string = getFFmpegPath()): Promise<FFmpegProcess> {
    const outputStreams = this.#outputs.filter((output) => output.isStream)
      .map((output) => outputStreamMap.get(output)!);
    const outputSockets = await Promise.all(
      outputStreams.map(([sockPath]) => getSocketServer(sockPath))
    );
    outputStreams.forEach(([, streams], i) => {
      handleOutputStream(outputSockets[i], streams);
    });
    const inputStreams = this.#inputs.filter((input) => input.isStream)
      .map((input) => inputStreamMap.get(input)!);
    const inputSockets = await Promise.all(
      inputStreams.map(([sockPath]) => getSocketServer(sockPath))
    );
    inputStreams.forEach(([, stream], i) => {
      handleInputStream(inputSockets[i], stream);
    });
    return new Process(ffmpegPath, this.getArgs());
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
  constructor(public ffmpegPath: string, public args: string[]) {
    this.#process = spawn(ffmpegPath, args, { stdio: 'pipe' });
  }
  get pid(): number {
    return this.#process.pid;
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    return this.#process.kill(signal);
  }
  pause(): boolean {
    if (isWin32) throw new TypeError('pause() cannot be used on Windows (yet)');
    return this.kill('SIGSTOP');
  }
  resume(): boolean {
    if (isWin32) throw new TypeError('resume() cannot be used on Windows (yet)');
    return this.kill('SIGCONT');
  }
  wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onExit = (code: number) => {
        if (code === 0) resolve();
        else reject(); // TODO: add exception
      };
      const process = this.#process;
      const code = process.exitCode;
      if (code !== null) onExit(code);
      else process.on('exit', onExit);
    });
  }
  progress(): AsyncGenerator<Progress, void, void> {
    return progressGenerator(this.#process.stdout);
  }
  unwrap(): ChildProcess {
    return this.#process;
  }
}

const inputStreamMap = new WeakMap<Input, [string, AsyncGenerator<Uint8Array, void, void>]>();
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
        inputStreamMap.set(this, [sockPath, __asyncValues([source])]);
        this.#resource = 'file:' + sockPath;
        this.isStream = true;
      } else {
        const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source);
        this.#resource = `data:application/octet-stream;base64,${buffer.toString('base64')}`;
        this.isStream = false;
      }
    } else {
      const sockPath = getSockPath();
      inputStreamMap.set(this, [sockPath, __asyncValues(source)]);
      this.#resource = 'file:' + sockPath;
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
      this.#resource = 'file:' + sockPath;
      this.isStream = true;
    } else if (destinations.length === 1) {
      const dest = destinations[0];
      if (typeof dest === 'string') {
        this.#resource = dest;
        this.isStream = false;
      } else {
        const sockPath = getSockPath();
        outputStreamMap.set(this, [sockPath, [writableToAsyncGenerator(dest)]]);
        this.#resource = 'file:' + sockPath;
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
            resources.push('file:' + sockPath);
            this.isStream = true;
          }
          streams.push(writableToAsyncGenerator(dest));
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
      // Errors are not relevant, logging or anything extra would just
      // increase overhead.
    }
  }
}

async function handleInputStream(server: Server, stream: AsyncGenerator<BufferLike, void, void>) {
  server.on('connection', async (socket) => {
    socket.on('close', () => stream.return?.());
    server.close();
    try {
      for await (const chunk of stream) {
        if (socket.writableEnded) break;
        await write(socket, chunk);
      }
    } catch {
      // TODO: add logging.
    } finally {
      try { if (!socket.writableEnded) await end(socket); }
      catch { /* Further errors are just ignored. */ }
    }
  });
}

async function handleOutputStream(server: Server, streams: AsyncGenerator<void, void, Uint8Array>[]) {
  server.on('connection', async (socket) => {
    // starts all the streams.
    streams.forEach((stream) => stream.next());

    socket.on('data', (data: Buffer) => {
      const u8 = toUint8Array(data);
      streams.forEach((stream) => stream.next(u8));
    });
    socket.on('close', () => {
      streams.forEach((stream) => stream.return?.());
    });
    server.close();
  });
}

function writableToAsyncGenerator(stream: NodeJS.WritableStream | { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; }): AsyncGenerator<void, void, Uint8Array> {
  if ('writable' in stream) {
    return asyncGeneratorFromStream(stream);
  } else {
    return __asyncValues(stream);
  }
}

async function* asyncGeneratorFromStream(stream: NodeJS.WritableStream): AsyncGenerator<void, void, Uint8Array> {
  try {
    for (;;) {
      await write(stream, yield);
    }
  } finally {
    await end(stream);
  }
}

// async function* fromIterable(stream: { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; }): AsyncGenerator<void, void, Uint8Array> {
//   const it = __asyncValues(stream) as AsyncIterator<any, any, Uint8Array>;
//   let r: IteratorResult<any>, e, m;
//   try {
//     while (r = await it.next(yield), !r.done);
//   }
//   catch (error) { e = { error }; }
//   finally {
//     try { if (r! && !r!.done && (m = it.return)) m.call(it); }
//     // eslint-disable-next-line no-unsafe-finally
//     finally { if (e) throw e.error; }
//   }
// }
