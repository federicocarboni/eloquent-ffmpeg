/** @internal */
export function read(stream: NodeJS.ReadableStream): Promise<Buffer> {
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
