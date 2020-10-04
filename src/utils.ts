/** @internal */
export const isWin32 = process.platform === 'win32';

/** @internal */
export const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

/** @internal */
export function read(stream: NodeJS.ReadableStream): Promise<Buffer> {
  if (!stream.readable) throw new TypeError('Cannot read stream');
  const chunks: Buffer[] = [];
  const onData = (chunk: Buffer): void => {
    chunks.push(chunk);
  };
  stream.on('data', onData);
  return new Promise((resolve, reject) => {
    stream.once('end', () => {
      const buffer = Buffer.concat(chunks);
      stream.off('error', reject);
      stream.off('data', onData);
      resolve(buffer);
    });
    stream.once('error', reject);
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
export function end(stream: NodeJS.WritableStream, chunk?: any): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.end(chunk, () => {
      stream.off('error', reject);
      resolve();
    });
    stream.once('error', reject);
  });
}

export type BufferLike = Buffer | ArrayBufferView | ArrayBuffer;

/** @internal */
export function isArrayBuffer(o: unknown): o is ArrayBuffer {
  return o instanceof ArrayBuffer;
}

/** @internal */
export function isBufferLike(o: unknown): o is BufferLike {
  return Buffer.isBuffer(o) || ArrayBuffer.isView(o) || isArrayBuffer(o);
}

/** @internal */
export function toUint8Array(bufferLike: BufferLike): Uint8Array {
  if (Buffer.isBuffer(bufferLike)) return bufferLike;
  return new Uint8Array(isArrayBuffer(bufferLike) ? bufferLike : bufferLike.buffer);
}
