import { createServer, Server } from 'net';
import { isWin32 } from './utils';
import { v4 } from 'uuid';

/* istanbul ignore next */
export const getSocketPath = isWin32 ? (): string => (
  `//./pipe/ffmpeg-ipc-${v4()}.sock`
) : (): string => (
  `/tmp/ffmpeg-ipc-${v4()}.sock`
);

/* istanbul ignore next */
export const getSocketUrl = isWin32 ? (path: string): string => (
  `file:${path}`
) : (path: string): string => (
  `unix:${path}`
);

export const createSocketServer = (path: string): Promise<Server> => (
  new Promise((resolve) => {
    const server = createServer();
    server.listen(path, () => resolve(server));
  })
);
