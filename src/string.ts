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
export function stringifyFilterDescription(filter: string, options?: Record<string, unknown> | unknown[]) {
  if (isNullish(options))
    return filter;
  const opts = Array.isArray(options)
    ? stringifyArrayColonSeparated(options)
    : stringifyObjectColonSeparated(options);
  if (opts === '')
    return filter;
  return `${filter}=${escapeFilterDescription(opts)}`;
}

/**
 * Turn an array into a `:`-separated list of values. Nullish values (`null` or `undefined`) are
 * ignored. Values are escaped using {@link escapeFilterValue}.
 *
 * @returns A string containing a list of `:`-separated list of values, may be `''`
 * (empty string) if the array is empty or if all of its values are nullish.
 */
export function stringifyArrayColonSeparated(array: unknown[]) {
  return array
    .filter((value) => !isNullish(value))
    .map((value) => escapeFilterValue(stringifyValue(value)))
    .join(':');
}

/**
 * Turn an object into a `:`-separated list of `key=value` pairs. Nullish values (`null` or
 * `undefined`) are ignored. Values are escaped using {@link escapeFilterValue}.
 * No checks are applied to keys, they are assumed to be valid in FFmpeg.
 *
 * @returns A string containing a list of `:`-separated list of `key=value` pairs, may be `''`
 * (empty string) if the object is empty or if all of its values are nullish.
 */
export function stringifyObjectColonSeparated(object: Record<string, unknown>) {
  return Object.entries(object)
    .filter(([, value]) => !isNullish(value))
    .map(([key, value]) => `${key}=${escapeFilterValue(stringifyValue(value))}`)
    .join(':');
}

/**
 * Turn an arbitrary JavaScript value into a string, all values but `Date`s are coerced to a string.
 * `Date` objects are converted to an ISO string (e.g. `1970-01-01T00:00:00.000Z`) which is a valid
 * date format in FFmpeg.
 * @see https://ffmpeg.org/ffmpeg-utils.html#Date
 */
export function stringifyValue(value: unknown): string {
  return types.isDate(value) ? value.toISOString() : `${value}`;
}

export function escapeFilterValue(s: string) {
  return `${s}`.replace(/[\\':]/g, (c) => `\\${c}`);
}

export function escapeFilterDescription(s: string) {
  return `${s}`.replace(/[\\'[\],;]/g, (c) => `\\${c}`);
}

export function escapeConcatFile(s: string) {
  return `${s}`.replace(/[\\' ]/g, (c) => `\\${c}`);
}

export function escapeTeeComponent(s: string) {
  return `${s}`.replace(/[\\' |[\]]/g, (c) => `\\${c}`);
}
