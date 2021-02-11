import { createServer, Server } from 'net';
import { isWin32 } from './utils';
import { v4 } from 'uuid';

/* istanbul ignore next */
export const getSocketPath = isWin32
  ? () => `//./pipe/ffmpeg-ipc-${v4()}.sock`
  : () => `/tmp/ffmpeg-ipc-${v4()}.sock`;

/* istanbul ignore next */
export const getSocketURL = isWin32
  ? (path: string) => `file:${path}`
  : (path: string) => `unix:${path}`;

export const createSocketServer = (path: string): Promise<Server> => new Promise((resolve) => {
  const server = createServer();
  server.listen(path, () => resolve(server));
});
