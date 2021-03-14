import { Server, createServer } from 'net';
import { v4 } from 'uuid';

import { isWin32 } from './utils';

export const getSocketPath = isWin32
  ? () => `//./pipe/ffmpeg-ipc-${v4()}.sock`
  : () => `/tmp/ffmpeg-ipc-${v4()}.sock`;

export const getSocketURL = isWin32
  ? (path: string) => `file:${path}`
  : (path: string) => `unix:${path}`;

export const startSocketServer = (path: string): Promise<Server> => new Promise((resolve) => {
  const server = createServer();
  server.listen(path, () => resolve(server));
});
