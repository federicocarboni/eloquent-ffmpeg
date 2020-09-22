import { LogLevel, ProbeResult } from './types';
import { getFFprobePath } from './env';
import { spawn } from 'child_process';
import { read } from './utils';

const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

export interface ProbeOptions {
  probeSize?: number;
  analyzeDuration?: number;
  ffprobePath?: string;
  args?: any[];
}

export async function probe(buffer: Buffer, options?: ProbeOptions): Promise<ProbeResult>;
export async function probe(stream: NodeJS.ReadableStream, options?: ProbeOptions): Promise<ProbeResult>;
export async function probe(path: string, options?: ProbeOptions): Promise<ProbeResult>;
export async function probe(input: NodeJS.ReadableStream | Buffer | string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const {
    probeSize = 5242880,
    analyzeDuration = 5000,
    ffprobePath = getFFprobePath()
  } = options;
  const ffprobe = spawn(ffprobePath, [
    '-hide_banner',
    '-v', LogLevel.Error.toString(),
    '-i', typeof input === 'string' ? input : 'pipe:0',
    '-probesize', probeSize.toString(),
    '-analyzeduration', (analyzeDuration * 1000).toString(),
    '-of', 'json=c=1',
    '-show_streams',
    '-show_format',
    '-show_error',
    '-show_chapters'
  ], { stdio: 'pipe' });
  const stdin = ffprobe.stdin;
  try {
    if (Buffer.isBuffer(input)) await new Promise((resolve, reject) => {
      const onError = (error: Error & { code: string }) => {
        if (IGNORED_ERRORS.has(error.code)) return;
        reject(error);
      };
      stdin.end(input, () => {
        stdin.off('error', onError);
        resolve();
      });
      stdin.on('error', onError);
    });
    else if (typeof input !== 'string') {
      await new Promise((resolve, reject) => {
        const onError = (error: Error & { code: string }) => {
          if (IGNORED_ERRORS.has(error.code)) return;
          reject(error);
        };
        stdin.on('close', () => {
          stdin.off('error', onError);
          input.unpipe(stdin);
          resolve();
        });
        stdin.on('error', onError);
        input.pipe(stdin);
      });
    }
    const stdout = await read(ffprobe.stdout);
    const result = JSON.parse(stdout.toString('utf-8'));
    if (result.error) {
      const stderr = await read(ffprobe.stderr);
      // TODO: add custom exception
      throw new Error(stderr.toString('utf-8'));
    }
    return new ProbeResult(result);
  } finally {
    if (ffprobe.exitCode === null) ffprobe.kill();
  }
}
