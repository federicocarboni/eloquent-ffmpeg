import { createServer, Server } from 'net';
import { isWin32 } from './utils';
import { v4 } from 'uuid';

export const getSockPath = isWin32 ? (): string => {
  return `//./pipe/${v4()}.sock`;
} : (): string => {
  return `/tmp/${v4()}.sock`;
};

export const getSockResource = isWin32 ? (path: string): string => {
  return `file:${path}`;
} : (path: string): string => {
  return `unix:${path}`;
};

export function getSocketServer(path: string): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(path, () => resolve(server));
  });
}
