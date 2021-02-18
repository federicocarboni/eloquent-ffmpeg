import { ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { types } from 'util';

export const isWin32 = process.platform === 'win32';

export const DEV_NULL = isWin32 ? 'NUL' : '/dev/null';

export const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

export const isNullish = (o: unknown): o is undefined | null => o === void 0 || o === null;

const isObject = (o: any) => o !== null && typeof o === 'object';

export const isReadableStream = (o: any): o is NodeJS.ReadableStream =>
  isObject(o) && o.readable && typeof o.read === 'function';

export const isWritableStream = (o: any): o is NodeJS.WritableStream =>
  isObject(o) && o.writable && typeof o.write === 'function';

export const read = (readable: NodeJS.ReadableStream, size = 0): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    let onReadable: () => void;
    let chunks: Uint8Array[] | undefined;
    if (size === 0) {
      chunks = [];
      onReadable = () => {
        let chunk: Buffer;
        while ((chunk = readable.read() as Buffer) !== null) {
          chunks!.push(chunk);
        }
      };
    } else {
      onReadable = () => {
        const chunk = readable.read(size) as Buffer;
        if (chunk !== null) {
          unlisten();
          resolve(chunk);
        }
      };
    }
    const unlisten = () => {
      readable.off('readable', onReadable);
      readable.off('end', onEnd);
      readable.off('error', onError);
    };
    const onEnd = () => {
      unlisten();
      resolve(Buffer.concat(chunks!));
    };
    const onError = (err: Error) => {
      unlisten();
      Error.captureStackTrace?.(err);
      reject(err);
    };
    readable.on('readable', onReadable);
    readable.on('end', onEnd);
    readable.on('error', onError);
  });

export const write = (writable: NodeJS.WritableStream, chunk: Uint8Array): Promise<void> =>
  new Promise((resolve, reject) => {
    writable.write(chunk, (err) => {
      if (err) {
        Error.captureStackTrace?.(err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

export const toReadableStream = (source: Uint8Array | AsyncIterable<Uint8Array>): NodeJS.ReadableStream =>
  isReadableStream(source) ? source : Readable.from(types.isUint8Array(source) ? [source] : source, { objectMode: false });

// Node.js <11 doesn't support `Array.prototype.flatMap()`, this uses `flatMap`
// if available or falls back to using `Array.prototype.map` and
// `Array.prototype.concat`.
// TODO: use `flatMap` directly when Node.js drops support for v10
/* istanbul ignore next */ // @ts-ignore
export const flatMap: <T, U>(array: T[], callback: (value: T, index: number, array: T[]) => U | ReadonlyArray<U>) => U[] = Array.prototype.flatMap
  ? (array, callback) => array.flatMap(callback)
  : (array, callback) => ([] as any[]).concat(...array.map(callback));

export let pause: (p: ChildProcess) => boolean;
export let resume: (p: ChildProcess) => boolean;

/* istanbul ignore next */
if (isWin32) {
  (() => {
    // On Windows `SIGSTOP` and `SIGCONT` cannot be used to pause and resume
    // processes because they are not supported; we call the native functions
    // `NtSuspendProcess()` and `NtResumeProcess()` from NTDLL through a
    // native Node.js addon packaged and released to NPM as `ntsuspend`.
    // https://github.com/FedericoCarboni/eloquent-ffmpeg/issues/1
    // https://github.com/FedericoCarboni/node-ntsuspend
    try {
      // Dynamically require `ntsuspend`, this will be replaced at built time
      // to support both commonjs, es modules and module bundlers.
      // TODO: replace this with a `await import()` when top-level `await` gets
      // better support
      const ntsuspend: typeof import('ntsuspend') = require('ntsuspend');
      pause = (p) => ntsuspend.suspend(p.pid);
      resume = (p) => ntsuspend.resume(p.pid);
    } catch {
      const error = new TypeError('Cannot require() ntsuspend https://git.io/JTqA9#error-ntsuspend');
      // `ntsuspend` is not supposed to be a hard dependency so we will
      // only throw when pause or resume are actually called
      pause = resume = () => { throw error; };
    }
  })();
} else {
  // On POSIX operating systems `SIGSTOP` and `SIGCONT` are available.
  pause = (p) => p.kill('SIGSTOP');
  resume = (p) => p.kill('SIGCONT');
}
