import { BufferLike, isArrayBuffer, isBufferLike, isWin32, toUint8Array, write } from './utils';
import { AudioFilter, VideoFilter } from './_types';
import { ChildProcess, spawn } from 'child_process';
import { LogLevel } from './probe/result';
import { __asyncValues } from 'tslib';
import { getFFmpegPath } from './env';

export type Source = string | BufferLike | AsyncIterable<BufferLike> | Iterable<BufferLike> | NodeJS.ReadableStream;

interface AsyncWritable<T> {
  [Symbol.asyncIterator](): AsyncIterator<any, any, T>;
}

interface Writable<T> {
  [Symbol.iterator](): Iterator<any, any, T>;
}

export type Destination = string | AsyncWritable<Uint8Array> | Writable<Uint8Array> | NodeJS.WritableStream;

export const MAX_BUFFER_LENGTH = isWin32 ? 16383 : 65536;

export interface Progress {
  speed: number;
  time: number;
}

async function* asyncGeneratorOf(bufferLike: BufferLike): AsyncGenerator<Uint8Array, void, void> {
  yield toUint8Array(bufferLike);
}

const privateMapStream: WeakMap<FFmpegInput, AsyncGenerator<Uint8Array, void, void> | NodeJS.ReadableStream> = new WeakMap();
export class FFmpegInput {
  #resource: string;
  #args: string[] = [];
  isStream: boolean;
  constructor (source: Source) {
    if (typeof source === 'string') {
      this.isStream = false;
      this.#resource = source;
    } else if (isBufferLike(source)) {
      if (source.byteLength > MAX_BUFFER_LENGTH) {
        this.#resource = 'pipe:0';
        privateMapStream.set(this, asyncGeneratorOf(source));
        this.isStream = true;
      } else {
        const buf = Buffer.isBuffer(source) ? source : Buffer.from(isArrayBuffer(source) ? source : source.buffer);
        this.#resource = `data:application/octet-stream;base64,${buf.toString('base64')}`;
        this.isStream = false;
      }
    } else {
      this.#resource = 'pipe:0';
      privateMapStream.set(this, 'pipe' in source ? source : __asyncValues(source));
      this.isStream = true;
    }
  }
  // TODO: implement
  getArgs(): string[] {
    return [...this.#args, '-i', this.#resource];
  }
}

export class FFmpegOutput {
  #destinations: Destination[];
  private videoFilters: [string, string?][] = [];
  private audioFilters: [string, string?][] = [];
  constructor (destinations: Destination[]) {
    this.#destinations = destinations;
  }
  videoFilter(filter: VideoFilter, options?: Record<string, string>) {
    this.videoFilters.push([filter, '' + options]);
    return this;
  }
  audioFilter(filter: AudioFilter, options?: Record<string, string>) {
    this.audioFilters.push([filter, '' + options]);
    return this;
  }
  // TODO: implement
  getArgs(): string[] {
    // const outputUri = this.#destinations.length ? null: 1;
    return [];
  }
}

export class FFmpegProcess {
  #process: ChildProcess;
  constructor (ffmpegPath: string, inputs: FFmpegInput[], outputs: FFmpegOutput[], args: string[]) {
    const process = this.#process = spawn(ffmpegPath, args, { stdio: 'pipe' });
    for (const input of inputs) if (input.isStream) {
      const stream = privateMapStream.get(input)!;
      if ('pipe' in stream) stream.pipe(process.stdin);
      else (async () => {
        for await (const chunk of stream) {
          await write(process.stdin, chunk);
        }
      })();
    }
  }
  // TODO: implement
  complete(): Promise<void> {
    return Promise.resolve();
  }
  // TODO: implement
  progress(): AsyncGenerator<Progress, number, void> {
    return null as any;
  }
  // TODO: very platform specific, windows support will eventually be added.
  pause(): boolean {
    return this.kill('SIGCONT');
  }
  // TODO: very platform specific, windows support will eventually be added.
  resume(): boolean {
    return this.kill('SIGCONT');
  }
  get pid(): number {
    return this.#process.pid;
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    return this.#process.kill(signal);
  }
  unwrap(): ChildProcess {
    return this.#process;
  }
}

export class FFmpegCommand {
  #args: string[] = [];
  #inputs: FFmpegInput[] = [];
  #outputs: FFmpegOutput[] = [];
  #hasStreamInput = false;
  #ffmpegPath: string;
  constructor (ffmpegPath: string, options: FFmpegOptions = {}) {
    this.#ffmpegPath = ffmpegPath;
    const {
      logLevel = LogLevel.Error
    } = options;
    this.#args.push('-v', logLevel.toString());
  }
  // TODO: implement
  input(source: Source): FFmpegInput {
    const input = new FFmpegInput(source);
    if (this.#hasStreamInput && input.isStream)
      throw new TypeError('Cannot use more than one streaming input');
    this.#hasStreamInput = input.isStream;
    this.#inputs.push(input);
    return input;
  }
  // TODO: implement
  output(...destinations: Destination[]) {
    const output = new FFmpegOutput(destinations);
    this.#outputs.push(output);
    return output;
  }
  // TODO: implement
  filterComplex(): this {
    return this;
  }
  // TODO: implement
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  // TODO: implement
  process(): FFmpegProcess {
    return new FFmpegProcess(this.#ffmpegPath, this.#inputs, this.#outputs, this.getArgs());
  }
  // TODO: implement
  getArgs(): string[] {
    return [];
  }
}

export interface FFmpegOptions {
  logLevel?: LogLevel;
}

export function ffmpegCommand(ffmpegPath = getFFmpegPath(), options?: FFmpegOptions): FFmpegCommand {
  return new FFmpegCommand(ffmpegPath, options);
}
