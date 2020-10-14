import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import inject from '@rollup/plugin-inject';
import { execSync } from 'child_process';
import * as path from 'path';
import pkg from './package.json';

const commit = execSync('git rev-parse HEAD').toString('utf-8').slice(0, -1);

const banner = `/**
 * ${pkg.name} v${pkg.version}
 * ${new Date().toUTCString()} — git ${commit}
 * ${pkg.homepage}
 * @license ${pkg.license}
 * @author ${pkg.author.name}
 */`;

const external = ['child_process', 'crypto', 'readline', 'stream', 'net', 'path', 'fs'];
const plugins = [
  typescript({
    tsconfig: './tsconfig.es6.json'
  }),
  resolve(),
  cleanup({
    comments: 'none',
    include: ['src/**/*.ts', 'node_modules/**'],
    extensions: ['ts', 'js'],
  }),
];

export default [{
  input: 'src/lib.ts',
  output: [{
    entryFileNames: 'lib.mjs',
    format: 'es',
    dir: 'lib',
    banner,
  }],
  plugins: [
    ...plugins,
    inject({
      modules: {
        require: [path.resolve('src/require.ts'), 'require']
      }
    })
  ],
  external,
}, {
  input: 'src/lib.ts',
  output: [{
    entryFileNames: 'lib.cjs',
    format: 'cjs',
    dir: 'lib',
    banner,
  }],
  plugins,
  external,
}];
