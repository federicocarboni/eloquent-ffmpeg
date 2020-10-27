import { escapeFilterComponent } from './string';

/**
 * Stringifies a given filter with its options to ffmpeg's filter graph syntax.
 * @param filter The filter's name, {@link VideoFilter} {@link AudioFilter}
 * @param options The filter's options.
 * @see https://ffmpeg.org/ffmpeg-filters.html#Filtergraph-syntax-1
 * @example ```ts
 * const filter = stringifySimpleFilter('scale', [1280, 720]);
 * filter === 'scale=1280:720';
 * const filter = stringifySimpleFilter('loudnorm', { linear: true });
 * filter === 'loudnorm=linear=true';
 * const filter = stringifySimpleFilter('negate');
 * filter === 'negate';
 * ```
 * @internal
 */
export function stringifySimpleFilterGraph(filter: string, options?: Record<string, any> | any[]) {
  if (options === void 0)
    return filter;
  if (Array.isArray(options)) {
    if (options.length === 0)
      return filter;
    return `${filter}=${options.map(escapeFilterComponent).join(':')}`;
  } else {
    const entries = Object.entries(options);
    if (entries.length === 0)
      return filter;
    return `${filter}=${entries.map(([key, value]) =>
      `${key}=${escapeFilterComponent(value)}`
    ).join(':')}`;
  }
}
