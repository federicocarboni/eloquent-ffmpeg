export class FFmpegError extends Error {
  constructor(message: string, public stderr: readonly string[]) {
    super(message);
  }
}

export class FFprobeError extends Error {
  constructor(message: string, public stderr: readonly string[], public code?: number) {
    super(message);
  }
}

export function extractMessage(stderr: string[]): string | undefined {
  let message: string | undefined;
  for (const line of stderr) {
    if (line !== '') {
      if (!message && line.includes(': '))
        message = line.slice(line.indexOf(': ') + 2);
      if (line.startsWith('[NULL @ '))
        message = line.slice(line.indexOf('] ') + 2);
    }
  }
  return message;
}
