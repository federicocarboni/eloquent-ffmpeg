import resolve from '@rollup/plugin-node-resolve';
import { builtinModules } from 'module';

/** @type {import('rollup').RollupOptions[]} */
const config = [{
  input: 'index.mjs',
  output: [{
    file: 'build/index-rollup.js',
    format: 'cjs',
  }],
  plugins: [
    resolve(),
  ],
  external: [...builtinModules],
}];

export default config;
