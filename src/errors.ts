/**
 * Thrown when FFmpeg exits with a non-zero status code.
 * @public
 */
export class FFmpegError extends Error {
  name = 'FFmpegError';
  constructor(message: string, public readonly args: readonly string[], public readonly ffmpegPath: string) {
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
