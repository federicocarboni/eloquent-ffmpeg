import { createServer, Server } from 'net';
import { isWin32 } from './utils';
import { v4 } from 'uuid';

export const getSockPath = isWin32 ? (): string => {
  return `//./pipe/${v4()}.sock`;
} : (): string => {
  throw new Error('Not implemented.');
  // TODO: test this on unix.
  // return `/run/${v4()}.sock`;
};

export const getSockResource = isWin32 ? (path: string): string => {
  return `file:${path}`;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} : (path: string): string => {
  throw new Error('Not implemented.');
  // TODO: test this on unix.
  // return `unix:${path}`;
};

export function getSocketServer(path: string): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(path, () => resolve(server));
  });
}
