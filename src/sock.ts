import { createServer, Server } from 'net';
import { isWin32 } from './utils';
import { v4 } from 'uuid';

export const getSocketPath = isWin32 ? (): string => {
  return `//./pipe/${v4()}.sock`;
} : (): string => {
  return `/tmp/${v4()}.sock`;
};

export const getSocketResource = isWin32 ? (path: string): string => {
  return `file:${path}`;
} : (path: string): string => {
  return `unix:${path}`;
};

export function createSocketServer(path: string): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(path, () => resolve(server));
  });
}
