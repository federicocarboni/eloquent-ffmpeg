export function escapeFilterComponent(value: string) {
  return ('' + value).replace(/[:'[\],;]/g, (char) => `\\${char}`);
}

export function stringifySimpleFilter(filterName: string, options?: Record<string, any> | any[]) {
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
