import { getFFprobePath } from './env';
import { LogLevel, ProbeResult } from './types';
import { spawn } from 'child_process';
import { read, end } from './utils';

const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);

export interface ProbeOptions {
  probeSize?: number;
  analyzeDuration?: number;
  ffprobePath?: string;
  args?: any[];
}

export async function probe(buffer: Buffer, options: ProbeOptions = {}): Promise<ProbeResult> {
  const {
    probeSize = 5242880,
    analyzeDuration = 5000,
    ffprobePath = getFFprobePath()
  } = options;
  const ffprobe = spawn(ffprobePath, [
    '-hide_banner',
    '-v', LogLevel.Error.toString(),
    '-i', 'pipe:0',
    '-probesize', probeSize.toString(),
    '-analyzeduration', (analyzeDuration * 1000).toString(),
    '-of', 'json=c=1',
    '-show_streams',
    '-show_format',
    '-show_error',
    '-show_chapters'
  ], { stdio: 'pipe' });
  try {
    ffprobe.stdin.on('error', (error: Error & { code: string }) => {
      if (IGNORED_ERRORS.has(error.code)) return;
    });
    await end(ffprobe.stdin, buffer);
    const stdout = await read(ffprobe.stdout);
    const info = JSON.parse(stdout.toString('utf-8'));
    if (info.error) {
      const stderr = await read(ffprobe.stderr);
      throw new Error(stderr.toString('utf-8'));
    }
    return new ProbeResult(info);
  } finally {
    if (ffprobe.exitCode === null) ffprobe.kill();
  }
}
