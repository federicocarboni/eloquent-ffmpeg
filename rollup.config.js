import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import inject from '@rollup/plugin-inject';
import { execSync } from 'child_process';
import { builtinModules } from 'module';
import * as path from 'path';
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
    file: 'lib/lib.mjs',
    format: 'es',
    banner,
  }],
  plugins: [
    ...plugins,
    inject({
      modules: {
        require: [path.resolve('src/require.ts'), 'require']
      }
    }),
  ],
  external,
}, {
  input: 'src/lib.ts',
  output: [{
    file: 'lib/lib.cjs',
    format: 'cjs',
    interop: (id) => builtinModules.includes(id) ? 'default' : 'auto',
    banner,
  }],
  plugins,
  external,
}];
