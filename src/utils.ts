import { ChildProcess } from 'child_process';
import { Readable } from 'stream';

/** @internal */
export const isWin32 = process.platform === 'win32';

/** @internal */
export const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

/** @internal */
export function isNullish(o: unknown): o is undefined | null {
  return o === void 0 || o === null;
}

/** @internal */
export function read(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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
  });
}

/** @internal */
export function write(stream: NodeJS.WritableStream, chunk?: any): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(chunk, () => {
      stream.off('error', reject);
      resolve();
    });
    stream.once('error', reject);
  });
}

/** @internal */
export function toReadable(source: Uint8Array | AsyncIterable<Uint8Array>): NodeJS.ReadableStream {
  return 'readable' in source ? source : Readable.from(
    source instanceof Uint8Array ? [source] : source, { objectMode: false }
  );
}

/** @internal */
export let pause: (p: ChildProcess) => boolean;
/** @internal */
export let resume: (p: ChildProcess) => boolean;

/* istanbul ignore next */
if (isWin32) {
  (() => {
    // on Windows it is not possible to use `SIGSTOP` and `SIGCONT` to pause and
    // resume processes because they are not supported; we call the native
    // functions `NtSuspendProcess()` and `NtResumeProcess()` from NTDLL through
    // a native Node.js addon packaged and released to NPM as `ntsuspend`
    // https://github.com/FedericoCarboni/eloquent-ffmpeg/issues/1
    try {
      // dynamically require `ntsuspend`, require() will be created with
      // createRequire() in the es module build
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ntsuspend = require('ntsuspend');
      pause = (p) => ntsuspend.suspend(p.pid);
      resume = (p) => ntsuspend.resume(p.pid);
    } catch {
      const error = new TypeError('Cannot require() ntsuspend https://git.io/JTqA9#error-ntsuspend');
      // `ntsuspend` is not supposed to be a hard dependency so we throw only when pause/resume
      // are requested.
      pause = resume = () => { throw error; };
    }
  })();
} else {
  // on POSIX operating systems `SIGSTOP` and `SIGCONT` are available
  pause = (p) => p.kill('SIGSTOP');
  resume = (p) => p.kill('SIGCONT');
}
