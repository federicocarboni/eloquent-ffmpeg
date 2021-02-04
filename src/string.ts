/**
 * Escape special characters in FFmpeg
 * @see https://ffmpeg.org/ffmpeg-utils.html#Quoting-and-escaping
 * @see https://ffmpeg.org/ffmpeg-filters.html#Filtergraph-syntax-1
 * @see https://ffmpeg.org/ffmpeg-all.html#concat-1
 */

import { isNullish } from './utils';

/**
 * Stringifies a given filter with its options to ffmpeg's filter graph syntax.
 * @param filter The filter's name, {@link VideoFilter} {@link AudioFilter}
 * @param options The filter's options.
 * @see https://ffmpeg.org/ffmpeg-filters.html#Filtergraph-syntax-1
 */
export function stringifyFilterDescription(filter: string, options?: Record<string, any> | any[]) {
  if (isNullish(options))
    return filter;
  if (Array.isArray(options)) {
    const values = options.filter((value) => !isNullish(value) && value !== '');
    if (values.length === 0)
      return filter;
    return `${filter}=${values.map(escapeFilterValue).join(':')}`;
  } else {
    const opts = stringifyObjectColonSeparated(options);
    if (opts === '')
      return filter;
    return `${filter}=${opts}`;
  }
}

export function stringifyObjectColonSeparated(object: Record<string, any>) {
  return Object.entries(object)
    .filter(([, value]) => !isNullish(value) && value !== '')
    .map(([key, value]) => `${key}=${escapeFilterValue(value)}`)
    .join(':');
}

export function escapeConcatFile(s: string) {
  return ('' + s).replace(/[\\' ]/g, (c: string) => `\\${c}`);
}

export function escapeTeeComponent(s: string) {
  return ('' + s).replace(/[\\' |[\]]/g, (c: string) => `\\${c}`);
}

export function escapeFilterValue(s: string) {
  return ('' + s).replace(/[\\':]/g, (c: string) => `\\${c}`);
}

export function escapeFilterDescription(s: string) {
  return ('' + s).replace(/[\\'[\],;]/g, (c: string) => `\\${c}`);
}
