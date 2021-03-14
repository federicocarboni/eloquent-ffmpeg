/**
 * This module includes internal helpers
 */

import type { ChildProcess } from 'child_process';
import type { InputSource } from './types';

import { finished, Readable } from 'stream';
import { types } from 'util';

export const isWin32 = process.platform === 'win32';

export const DEV_NULL = isWin32 ? 'NUL' : '/dev/null';

export const isNullish = (o: unknown): o is undefined | null => o === void 0 || o === null;

export const isReadableStream = (o: any): o is NodeJS.ReadableStream =>
  o !== null && typeof o === 'object' && o.readable && typeof o.read === 'function';

export const isWritableStream = (o: any): o is NodeJS.WritableStream =>
  o !== null && typeof o === 'object' && o.writable && typeof o.write === 'function';

export const isInputSource = (o: any): o is InputSource => !isNullish(o) && (
  typeof o === 'string' || isReadableStream(o) || types.isUint8Array(o) ||
  typeof o[Symbol.iterator] === 'function' || typeof o[Symbol.asyncIterator] === 'function'
);

export const toReadableStream = (source: Exclude<InputSource, string>): NodeJS.ReadableStream =>
  isReadableStream(source) ? source : Readable.from(types.isUint8Array(source) ? [source] : source, { objectMode: false });

/**
 * Acts like `Array.prototype.flatMap()`: Node.js <11 doesn't support it. Uses `flatMap` directly
 * when available, or `Array.prototype.map` and `Array.prototype.concat`.
 * @internal
 */
// TODO: use `flatMap` directly when Node.js drops support for v10 https://github.com/nodejs/Release
export const flatMap: <T, U>(arr: T[], cb: (v: T, i: number, arr: T[]) => U | readonly U[]) => U[] =
  Array.prototype.flatMap
    ? Function.prototype.call.bind(Array.prototype.flatMap)
    : (arr, cb) => ([] as any[]).concat(...arr.map(cb));

// ReadableStream.read() is limited to 1GiB reads
// https://nodejs.org/api/stream.html#stream_readable_read_size
const NODEJS_READ_LIMIT = 1073741824;

export const read = (readable: NodeJS.ReadableStream, size = 0): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    if (!Number.isInteger(size) || size > NODEJS_READ_LIMIT)
      throw new RangeError(`Cannot read ${size} bytes from readable stream`);
    if (!readable.readable)
      throw new TypeError(`Cannot read stream, the stream is not readable`);
    let onReadable: () => void;
    let cleanup: (() => void) | undefined;
    if (size === 0) {
      // When size is zero consume the stream.
      let totalLength = 0;
      const chunks: Buffer[] = [];
      onReadable = () => {
        let chunk: Buffer;
        while ((chunk = readable.read() as Buffer) !== null) {
          totalLength += chunk.length;
          chunks.push(chunk);
        }
      };
      cleanup = finished(readable, () => {
        unlisten();
        resolve(Buffer.concat(chunks, totalLength));
      });
    } else {
      onReadable = () => {
        const chunk = readable.read(size) as Buffer;
        if (chunk !== null) {
          unlisten();
          resolve(chunk);
        }
      };
    }
    const onError = (err: Error) => {
      unlisten();
      Error.captureStackTrace?.(err);
      reject(err);
    };
    const unlisten = () => {
      readable.off('readable', onReadable);
      readable.off('error', onError);
      cleanup?.();
    };
    readable.on('readable', onReadable);
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

export const exited = (cp: ChildProcess): Promise<void> => new Promise((resolve, reject) => {
  const unlisten = () => {
    cp.off('exit', onExit);
    cp.off('error', onError);
  };
  const onExit = () => {
    unlisten();
    resolve();
  };
  const onError = (error: Error) => {
    unlisten();
    Error.captureStackTrace?.(error);
    reject(error);
  };
  cp.on('exit', onExit);
  cp.on('error', onError);
});

export let pause: (p: ChildProcess) => boolean;
export let resume: (p: ChildProcess) => boolean;

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
      // to support commonjs, es modules and module bundlers.
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
