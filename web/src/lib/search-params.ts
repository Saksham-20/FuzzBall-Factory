/** A query-string value as a single string: Next gives an array when a key repeats (`?a=1&a=2`), so take the first. */
export const first = (value?: string | string[]): string | undefined => (Array.isArray(value) ? value[0] : value);
