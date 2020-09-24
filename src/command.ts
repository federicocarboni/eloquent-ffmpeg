import { BufferLike, isArrayBuffer, isBufferLike, isWin32, toUint8Array } from './utils';
import { AudioFilter, VideoFilter } from './_types';
import { LogLevel } from './probe/result';
import { __asyncValues } from 'tslib';

export type Source = string | BufferLike | AsyncIterable<BufferLike> | Iterable<BufferLike> | NodeJS.ReadableStream;

interface AsyncWritable<T> {
  [Symbol.asyncIterator](): AsyncIterator<any, any, T>;
}

interface Writable<T> {
  [Symbol.iterator](): Iterator<any, any, T>;
}

export type Destination = string | AsyncWritable<Uint8Array> | Writable<Uint8Array> | NodeJS.WritableStream;

export const MAX_BUFFER_LENGTH = isWin32 ? 16383 : 65536;

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
  getArgs(): string[] {
    // const outputUri = this.#destinations.length ? null: 1;
    return [];
  }
}

export class FFmpegCommand {
  #args: string[] = [];
  #inputs: FFmpegInput[] = [];
  #outputs: FFmpegOutput[] = [];
  #hasStreamInput = false;
  constructor (options: FFmpegOptions = {}) {
    const {
      logLevel = LogLevel.Error
    } = options;
    this.#args.push('-v', logLevel.toString());
  }
  input(source: Source): FFmpegInput {
    const input = new FFmpegInput(source);
    if (this.#hasStreamInput && input.isStream)
      throw new TypeError('Cannot use more than one streaming input');
    this.#hasStreamInput = input.isStream;
    this.#inputs.push(input);
    return input;
  }
  output(...destinations: Destination[]) {
    const output = new FFmpegOutput(destinations);
    this.#outputs.push(output);
    return output;
  }
  filterComplex(): this {
    return this;
  }
  args(...args: string[]): this {
    this.#args.push(...args);
    return this;
  }
  getArgs(): string[] {
    return [];
  }
}

export interface FFmpegOptions {
  logLevel?: LogLevel;
}

export function ffmpegCommand(options?: FFmpegOptions): FFmpegCommand {
  return new FFmpegCommand(options);
}
