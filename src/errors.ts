/**
 * Thrown when FFmpeg exits with a non-zero status code.
 * @public
 */
export class FFmpegError extends Error {
  name = 'FFmpegError';
  constructor(message: string, public stderr: readonly string[]) {
    super(message);
  }
}

/**
 * Thrown when FFprobe exits with a non-zero status code.
 * @public
 */
export class FFprobeError extends Error {
  name = 'FFprobeError';
  constructor(message: string, public stderr: readonly string[], public code?: number) {
    super(message);
  }
}

export function extractMessage(stderr: string[]): string | undefined {
  let message: string | undefined;
  for (const line of stderr) {
    if (!message && line.includes(': '))
      message = line.slice(line.indexOf(': ') + 2);
    if (line.startsWith('[NULL @ '))
      message = line.slice(line.indexOf('] ') + 2);
  }
  return message;
}
