import { ChildProcess, ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { BufferLike, end, isBufferLike, isWin32, write } from './utils';
import { createInterface as readlines } from 'readline';
import { getSocketServer, getSockPath, getSockResource } from './sock';
import { toUint8Array } from './utils';
import { getFFmpegPath } from './env';
import { __asyncValues } from 'tslib';
import { Server, Socket } from 'net';

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

export interface FFmpegCommand {
  /**
   * Adds an input to the conversion.
   * @param source
   * @example ```ts
   * const cmd = ffmpeg();
   * cmd.input('input.avi');
   * cmd.input(fs.createReadStream('input2.avi'));
   * cmd.output();
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
   */
  input(source: InputSource): FFmpegInput;
  /**
   * Adds an output to the conversion, multiple destinations are supported using
   * the `tee` protocol. You can use mixed destinations and multiple streams.
   * Both NodeJS WritableStreams and AsyncGenerators are fully supported.
   * @param destinations A sequence of OutputDestinations to which the output
   * will be written. If not destinations are specified the conversion will run,
   * but any output data will be ignored.
   * @example ```ts
   * const cmd = ffmpeg();
   * cmd.input('input.avi');
   * cmd.output(fs.createWriteStream('dest1.mkv'), 'dest2.mkv');
   * const process = await cmd.spawn();
   * await process.complete();
   * ```
   */
  output(...destinations: OutputDestination[]): FFmpegOutput;
  /**
   * Add arguments, they will be placed before any input or output arguments.
   * @param args
   */
  args(...args: string[]): this;
  /**
   * Starts the conversion, this method is asynchronous so it must be `await`'ed.
   * @param ffmpegPath Path to the ffmpeg executable. Defaults to `getFFmpegPath()`.
   * @example ```ts
   * const cmd = ffmpeg();
   * cmd.input('input.avi');
   * cmd.output('output.mp4');
   * const process = await cmd.spawn();
   * ```
   */
  spawn(ffmpegPath?: string): Promise<FFmpegProcess>;
  /**
   * Returns all the arguments with which ffmpeg will be spawned.
   */
  getArgs(): string[];
}

export interface FFmpegOptions {
  /**
   * Change FFmpeg's LogLevel, defaults to `LogLevel.Error`.
   */
  logLevel?: LogLevel;
  /**
   * Enabled piping the conversion progress, if set to `false` {@link FFmpegProcess.progress}
   * will silently will silently fail. Defaults to `true`.
   */
  progress?: boolean;
  /**
   * Whether to overwrite the output destinations if they already exist. Required
   * to be `true` for streaming outputs. Defaults to `true`.
   */
  overwrite?: boolean;
}

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

export interface FFmpegInput {
  /**
   * Add input arguments, they will be placed before any additional arguments.
   * @param args
   */
  args(...args: string[]): this;
  /**
   * Returns all the arguments for the input.
   */
  getArgs(): string[];
  /**
   * Whether the input is using streams.
   */
  readonly isStream: boolean;
}

export interface FFmpegOutput {
  /**
   * Add output arguments, they will be placed before any additional arguments.
   * @param args
   */
  args(...args: string[]): this;
  /**
   * Returns all the arguments for the output.
   */
  getArgs(): string[];
  /**
   * Whether the output is using streams.
   */
  readonly isStream: boolean;
}

export interface FFmpegProcess {
  /**
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
   * @example ```ts
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
   * @example ```ts
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
   * Returns the underlying NodeJS' ChildProcess instance.
   */
  unwrap(): ChildProcess;
  /**
   * Sends a signal to the running process.
   * See {@link https://nodejs.org/api/child_process.html#child_process_subprocess_kill_signal}
   * @param signal The signal to send.
   */
  kill(signal?: NodeJS.Signals | number): boolean;
  /**
   * Pauses the conversion, returns `true` if the operation succeeds, `false` otherwise.
   * This does NOT currently work on Windows, support is planned.
   */
  pause(): boolean;
  /**
   * Resumes the conversion, returns `true` if the operation succeeds, `false` otherwise.
   * This does NOT currently work on Windows, support is planned.
   */
  resume(): boolean;
}

export function ffmpeg(options?: FFmpegOptions): FFmpegCommand {
  return new Command(options);
}

export const MAX_BUFFER_LENGTH = 16383;

class Command implements FFmpegCommand {
  #args: string[] = [];
  #inputs: Input[] = [];
  #outputs: Output[] = [];

  private logLevel: LogLevel;
  constructor(options: FFmpegOptions = {}) {
    this.logLevel = options.logLevel ?? LogLevel.Error;
    this.#args.push(options.overwrite !== false ? '-y' : '-n');
    if (options.progress !== false)
      this.#args.push('-progress', 'pipe:1', '-nostats');
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
    const [inputSocketServers, outputSocketServers] = await Promise.all([handleInputs(this.#inputs), handleOutputs(this.#outputs)]);
    return new Process(ffmpegPath, this.getArgs(), inputSocketServers, outputSocketServers);
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
  constructor(public ffmpegPath: string, public args: string[], inputSocketServers: Server[], outputSocketServers: Server[]) {
    const process = spawn(ffmpegPath, args, { stdio: 'pipe' });
    const onExit = (): void => {
      inputSocketServers.forEach(closeSocketServer);
      outputSocketServers.forEach(closeSocketServer);
      process.off('exit', onExit);
      process.off('error', onError);
    };
    const onError = (error: Error): never => {
      if (process.exitCode !== null) onExit();
      throw error;
    };
    process.on('exit', onExit);
    process.on('error', onError);
    this.#process = process;
  }
  get pid(): number {
    return this.#process.pid;
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    return this.#process.kill(signal);
  }
  pause(): boolean {
    if (isWin32) throw new TypeError('pause() cannot be used on Windows (yet)');
    const process = this.#process;
    if (process.exitCode !== null) return false;
    return process.kill('SIGSTOP');
  }
  resume(): boolean {
    if (isWin32) throw new TypeError('resume() cannot be used on Windows (yet)');
    const process = this.#process;
    if (process.exitCode !== null) return false;
    return process.kill('SIGSTOP');
  }
  complete(): Promise<void> {
    const process = this.#process;
    const code = process.exitCode;
    return new Promise((resolve, reject) => {
      const onExit = (code: number, signal: NodeJS.Signals | null) => {
        if (code === 0 || signal !== null) resolve();
        else reject(); // TODO: add exception
        process.off('exit', onExit);
      };
      if (code !== null) onExit(code, null);
      else process.on('exit', onExit);
    });
  }
  progress(): AsyncGenerator<Progress, void, void> {
    return createProgressGenerator(this.#process.stdout);
  }
  unwrap(): ChildProcess {
    return this.#process;
  }
}

const inputStreamMap = new WeakMap<Input, [string, AsyncIterableIterator<BufferLike>]>();
class Input implements FFmpegInput {
  #resource: string;
  #args: string[] = [];

  isStream: boolean;
  constructor(source: InputSource) {
    if (typeof source === 'string') {
      this.#resource = source;
      this.isStream = false;
    } else {
      const path = getSockPath();
      inputStreamMap.set(this, [path, __asyncValues(isBufferLike(source) ? [source] : source)]);
      this.#resource = getSockResource(path);
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
      const path = getSockPath();
      outputStreamMap.set(this, [path, []]);
      this.#resource = getSockResource(path);
      this.isStream = true;
    } else if (destinations.length === 1) {
      const dest = destinations[0];
      if (typeof dest === 'string') {
        this.#resource = dest;
        this.isStream = false;
      } else {
        const path = getSockPath();
        outputStreamMap.set(this, [path, [toAsyncGenerator(dest)]]);
        this.#resource = getSockResource(path);
        this.isStream = true;
      }
    } else {
      const resources: string[] = [];
      const streams: AsyncGenerator<void, void, Uint8Array>[] = [];
      const path = getSockPath();
      this.isStream = false;
      for (const dest of destinations) {
        if (typeof dest === 'string') {
          resources.push(dest.replace(/[[|\]]/g, (char) => `\\${char}`));
        } else {
          if (!this.isStream) {
            outputStreamMap.set(this, [path, streams]);
            resources.push(getSockResource(path));
            this.isStream = true;
          }
          streams.push(toAsyncGenerator(dest));
        }
      }
      this.#resource = resources.length > 1 ? `tee:${resources.join('|')}` : resources[0];
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

async function* createProgressGenerator(stream: NodeJS.ReadableStream) {
  let progress: Partial<Progress> = {};
  for await (const line of readlines(stream)) {
    try {
      const [key, rawValue] = line.split('=');
      const value = rawValue.trim();
      switch (key.trim()) {
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
          progress.bytes = +value >>> 0;
          break;
        case 'out_time_us':
          progress.time = +value / 1000 | 0;
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
          break;
      }
    } catch {
      // Errors are not relevant.
    }
  }
}

async function handleInputStreamSocket(socket: Socket, stream: AsyncIterableIterator<BufferLike>) {
  if (stream.return) socket.on('end', stream.return.bind(stream));
  try {
    for await (const chunk of stream) {
      await write(socket, toUint8Array(chunk));
    }
  } catch {
    //
  } finally {
    try {
      if (!socket.writableEnded) await end(socket);
    } catch {
      //
    }
  }
}
function handleInputStream(server: Server, stream: AsyncIterableIterator<BufferLike>) {
  server.on('connection', (socket) => {
    handleInputStreamSocket(socket, stream);
    server.close(() => {
      //
    });
  });
}
function handleOutputStream(server: Server, streams: AsyncGenerator<void, void, Uint8Array>[]) {
  server.on('connection', async (socket) => {
    // starts all the streams.
    streams.forEach((stream) => stream.next());

    socket.on('data', (data: Buffer) => {
      const u8 = toUint8Array(data);
      streams.forEach((stream) => stream.next(u8));
    });
    socket.on('end', () => {
      streams.forEach((stream) => stream.return?.());
    });
    server.close(() => {
      //
    });
  });
}

function toAsyncGenerator(stream: NodeJS.WritableStream | { [Symbol.asyncIterator](): AsyncIterator<any, any, Uint8Array>; } | { [Symbol.iterator](): Iterator<any, any, Uint8Array>; }): AsyncGenerator<void, void, Uint8Array> {
  if ('writable' in stream) {
    return asyncGeneratorFromStream(stream);
  } else {
    return __asyncValues(stream);
  }
}
async function* asyncGeneratorFromStream(stream: NodeJS.WritableStream): AsyncGenerator<void, void, Uint8Array> {
  try {
    for (; ;) {
      await write(stream, yield);
    }
  } finally {
    await end(stream);
  }
}

async function handleOutputs(outputs: Output[]) {
  const streams = outputs.filter(isStream).map(getOutputStream);
  const servers = await Promise.all(streams.map(getSockServer));
  streams.forEach(([, streams], i) => {
    handleOutputStream(servers[i], streams);
  });
  return servers;
}
async function handleInputs(inputs: Input[]) {
  const streams = inputs.filter(isStream).map(getInputStream);
  const servers = await Promise.all(streams.map(getSockServer));
  streams.forEach(([, stream], i) => {
    handleInputStream(servers[i], stream);
  });
  return servers;
}

function closeSocketServer(socketServer: Server) {
  if (socketServer.listening) socketServer.close();
}
function getSockServer([path]: [string, any]) {
  return getSocketServer(path);
}
function isStream(o: Output | Input) {
  return o.isStream;
}
function getOutputStream(output: Output) {
  return outputStreamMap.get(output)!;
}
function getInputStream(input: Input) {
  return inputStreamMap.get(input)!;
}
