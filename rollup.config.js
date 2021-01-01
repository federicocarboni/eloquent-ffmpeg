import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import cleanup from 'rollup-plugin-cleanup';
import inject from '@rollup/plugin-inject';
import { execSync } from 'child_process';
import { builtinModules } from 'module';
import pkg from './package.json';

const commit = execSync('git rev-parse HEAD').toString('utf-8').slice(0, 12);

const banner = `/**
 * ${pkg.name} v${pkg.version} — git ${commit}
 * ${new Date().toUTCString()}
 * ${pkg.homepage}
 * @license ${pkg.license}
 * @author ${pkg.author.name}
 */`;

const external = [...builtinModules, 'ntsuspend'];
const plugins = [
  typescript({
    tsconfig: './tsconfig.es6.json'
  }),
  resolve({
    exportConditions: ['node']
  }),
  cleanup({
    comments: 'none',
    include: ['src/**/*.ts', 'node_modules/**'],
    extensions: ['ts', 'js'],
  }),
];
const injectCreateRequire = inject({
  modules: {
    createRequire: ['module', 'createRequire'],
  },
});

/** @type {import('rollup').RollupOptions[]} */
const config = [{
  // Fixes #6 by providing a .js file for WebPack (and other bundlers) and a .mjs file
  // for Node.js imports. Unforturnately requires a lot of duplication since those two
  // files are mostly the same. See package.json's `exports` field.
  // https://github.com/FedericoCarboni/eloquent-ffmpeg/issues/6
  // This file is a bridge between commonjs and es modules.
  input: 'src/lib.ts',
  output: [{
    file: 'lib/lib.js',
    format: 'es',
    banner,
  }],
  plugins: [
    ...plugins,
    // Until top-level `await` gets better support, we're stuck with this build time
    // helper which enables support for dynamically `require()`ing ntsuspend from an
    // ES module. To support bundlers this build also checks if `require` is already
    // defined.
    replace({
      delimiters: ['', ''],
      values: {
        "require('ntsuspend')": `/* dynamic require ('ntsuspend') */ ((typeof require === 'function' ? require : createRequire(import.meta.url))('ntsuspend'))`,
      },
    }),
    injectCreateRequire,
  ],
  external,
}, {
  input: 'src/lib.ts',
  output: [{
    file: 'lib/lib.mjs',
    format: 'es',
    banner,
  }],
  plugins: [
    ...plugins,
    // Replace `require()` with `createRequire(import.meta.url)()` in the .mjs file.
    replace({
      delimiters: ['', ''],
      values: {
        "require('ntsuspend')": `/* dynamic require ('ntsuspend') */ (createRequire(import.meta.url)('ntsuspend'))`,
      },
    }),
    injectCreateRequire,
  ],
  external,
}, {
  input: 'src/lib.ts',
  output: [{
    file: 'lib/lib.cjs',
    format: 'cjs',
    // Avoid unnecessary interop helpers for Node.js builtins.
    interop: (id) => builtinModules.includes(id) ? 'default' : 'auto',
    banner,
  }],
  plugins,
  external,
}];

export default config;
