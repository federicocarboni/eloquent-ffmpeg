import { createRequire } from 'module';

// @ts-ignore
export const require = createRequire(import.meta.url);
