/**
 * Escapes special characters for FFmpeg.
 * @param s - The value to be escaped.
 * @public
 */
export function escapeConcatFile(s: string) {
  return ('' + s).replace(/[\\' ]/g, (c: string) => `\\${c}`);
}

/**
 * Escapes special characters in an FFmpeg's filter graph value.
 * @param s - The value to be escaped.
 * @public
 */
export function escapeFilterComponent(s: string) {
  return ('' + s).replace(/[\\':[\],;]/g, (c: string) => `\\${c}`);
}
