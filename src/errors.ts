/**
 * Thrown when FFmpeg exits with a non-zero status code.
 * @public
 */
export class FFmpegError extends Error {
  name = 'FFmpegError';
  constructor(message: string, public args: readonly string[], public ffmpegPath: string) {
    super(message);
  }
}

/**
 * Thrown when FFprobe exits with a non-zero status code.
 * @public
 */
export class FFprobeError extends Error {
  name = 'FFprobeError';
  constructor(message: string, public code: number, public args: readonly string[], public ffprobePath: string) {
    super(message);
  }
}
