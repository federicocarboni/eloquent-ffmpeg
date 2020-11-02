import { createRequire } from 'module';

// @ts-ignore
// `require()` is not available in ESM, in the ESM build we create the `require` function needed to
// dynamically and synchronously import modules.  An alternative would be `await import()` but it's
// not *currently* supported in LTS releases of Node.js. Modules imported by require are OPTIONAL,
// not intended to be loaded on-demand but conditionally, and allow recovery on errors.
// https://nodejs.org/api/esm.html
export const _require = createRequire(import.meta.url);
