/**
 * Escapes special characters in ffmpeg's filter graph syntax.
 * @param value The value to be escaped.
 */
export function escapeFilterComponent(value: string) {
  return ('' + value).replace(/[:'[\],;]/g, (char) => `\\${char}`);
}

/**
 * Stringifies a given filter with its options to ffmpeg's filter graph syntax.
 * @param filterName The filter's name, {@link VideoFilter} {@link AudioFilter}
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
 */
export function stringifySimpleFilterGraph(filterName: string, options?: Record<string, any> | any[]) {
  if (!options) return filterName;
  if (Array.isArray(options)) {
    if (!options.length) return filterName;
    return `${filterName}=${options.map(escapeFilterComponent).join(':')}`;
  } else {
    const entries = Object.entries(options);
    if (!entries.length) return filterName;
    return `${filterName}=${entries.map(([key, value]) =>
      `${key}=${escapeFilterComponent(value)}`
    ).join(':')}`;
  }
}
