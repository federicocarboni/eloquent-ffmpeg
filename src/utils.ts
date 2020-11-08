import { ChildProcess } from 'child_process';
import { Readable } from 'stream';

export const isWin32 = process.platform === 'win32';

export const DEV_NULL = isWin32 ? 'NUL' : '/dev/null';

export const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

export const isNullish = (o: unknown): o is undefined | null => o === void 0 || o === null;

export const isObject = (o: unknown): o is any => o !== null && typeof o === 'object';

const isStream = (o: unknown): o is any => isObject(o) && typeof o.pipe === 'function';

export const isReadableStream = (o: unknown): o is NodeJS.ReadableStream => {
  try {
    return isStream(o) &&
      'readable' in o && o.readable !== false &&
      typeof o._read === 'function' &&
      typeof o._readableState === 'object';
  } catch {
    return false;
  }
};

export const isWritableStream = (o: unknown): o is NodeJS.WritableStream => {
  try {
    return isStream(o) &&
      'writable' in o && o.writable !== false &&
      typeof o._write === 'function' &&
      typeof o._writableState === 'object';
  } catch {
    return false;
  }
};

export const read = (stream: NodeJS.ReadableStream): Promise<Buffer> => (
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const unlisten = (): void => {
      stream.off('readable', onReadable);
      stream.off('error', onError);
      stream.off('end', onEnd);
    };
    const onReadable = (): void => {
      let chunk: Uint8Array | null;
      while ((chunk = stream.read() as Uint8Array) !== null) {
        chunks.push(chunk);
      }
    };
    const onEnd = (): void => {
      const buffer = Buffer.concat(chunks);
      unlisten();
      resolve(buffer);
    };
    const onError = (reason?: any): void => {
      unlisten();
      reject(reason);
    };
    stream.on('readable', onReadable);
    stream.on('end', onEnd);
    stream.on('error', onError);
    stream.resume();
  })
);

export const write = (stream: NodeJS.WritableStream, chunk: Uint8Array): Promise<void> => (
  new Promise((resolve, reject) => {
    stream.write(chunk as any, () => {
      stream.off('error', reject);
      resolve();
    });
    stream.once('error', reject);
  })
);

export const toReadable = (source: Uint8Array | AsyncIterable<Uint8Array>): NodeJS.ReadableStream => (
  isReadableStream(source) ? source: Readable.from(
    source instanceof Uint8Array ? [source] : source, { objectMode: false }
  )
);

// Node.js <11 doesn't support `Array.prototype.flatMap()`, this uses `flatMap`
// if available or falls back to using `Array.prototype.map` and
// `Array.prototype.concat`; this solution works, but it's potentially subject
// to call stack size limits, though it's very very unlikely
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
    // on Windows `SIGSTOP` and `SIGCONT` cannot be used to pause and resume
    // processes because they are not supported; we call the native functions
    // `NtSuspendProcess()` and `NtResumeProcess()` from NTDLL through a
    // native Node.js addon packaged and released to NPM as `ntsuspend`
    // https://github.com/FedericoCarboni/eloquent-ffmpeg/issues/1
    // https://github.com/FedericoCarboni/node-ntsuspend
    try {
      // dynamically require `ntsuspend`, require() will be created with
      // createRequire() in the es module build
      const ntsuspend = require('ntsuspend');
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
  // on POSIX operating systems `SIGSTOP` and `SIGCONT` are available
  pause = (p) => p.kill('SIGSTOP');
  resume = (p) => p.kill('SIGCONT');
}
