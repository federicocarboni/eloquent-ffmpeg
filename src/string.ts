/**
 * This module handles escaping strings and stringifying JavaScript values into various FFmpeg
 * syntaxes. All code here is based on the FFmpeg docs or, sometimes, on FFmpeg's C sources.
 * The following functions are currently not considered part of the public API.
 * @see https://ffmpeg.org/ffmpeg-utils.html#Quoting-and-escaping
 * @see https://ffmpeg.org/ffmpeg-filters.html#Filtergraph-syntax-1
 * @see https://ffmpeg.org/ffmpeg-all.html#concat-1
 */

import { types } from 'util';
import { isNullish } from './utils';

/**
 * Stringify a filter with options into an FFmpeg filter description. `options` is stringified to
 * a `:`-separated list of `key=value` pairs if object, or to a `:`-separated list of `value`.
 * Nullish values (`null` or `undefined`) are ignored. `Date` objects are turned into an ISO string,
 * other non-string values are coerced to a string. All values are escaped using
 * {@link escapeFilterValue}.
 *
 * @see https://ffmpeg.org/ffmpeg-filters.html#Filtergraph-syntax-1
 */
export function stringifyFilterDescription(filter: string, options?: Record<string, any> | any[]) {
  if (isNullish(options))
    return filter;
  if (Array.isArray(options)) {
    const values = options.filter((value) => !isNullish(value));
    if (values.length === 0)
      return filter;
    return `${filter}=${values.map((value) => escapeFilterValue(stringifyValue(value))).join(':')}`;
  } else {
    const opts = stringifyObjectColonSeparated(options);
    if (opts === '')
      return filter;
    return `${filter}=${opts}`;
  }
}

/**
 * Turn an object into a `:`-separated list of `key=value` pairs. Nullish values (`null` or
 * `undefined`) are ignored. Values are escaped using {@link escapeFilterValue}.
 * No checks are applied to keys, they are assumed to be valid in FFmpeg.
 *
 * @returns A string containing a list of `:`-separated list of `key=value` pairs, may be `''`
 * (empty string) if the object is empty or if all of it's values are ignored.
 */
export function stringifyObjectColonSeparated(object: Record<string, unknown>) {
  return Object.entries(object)
    .filter(([, value]) => !isNullish(value))
    .map(([key, value]) => `${key}=${escapeFilterValue(stringifyValue(value))}`)
    .join(':');
}

/**
 * Turn an arbitrary JavaScript value `x` to a string, all values but `Date`s are coerced to a
 * string. `Date` objects are converted to an ISO string (`1970-01-01T00:00:00.000Z`) which is a
 * valid date format in FFmpeg.
 * @see https://ffmpeg.org/ffmpeg-utils.html#Date
 */
export function stringifyValue(value: unknown) {
  return types.isDate(value) ? value.toISOString() : '' + value;
}

export function escapeFilterValue(s: string) {
  return ('' + s).replace(/[\\':]/g, (c) => `\\${c}`);
}

export function escapeFilterDescription(s: string) {
  return ('' + s).replace(/[\\'[\],;]/g, (c) => `\\${c}`);
}

export function escapeConcatFile(s: string) {
  return ('' + s).replace(/[\\' ]/g, (c) => `\\${c}`);
}

export function escapeTeeComponent(s: string) {
  return ('' + s).replace(/[\\' |[\]]/g, (c) => `\\${c}`);
}
