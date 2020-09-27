import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import { execSync } from 'child_process';
import pkg from './package.json';

const commit = execSync('git rev-parse HEAD').toString('utf-8').slice(0, -1);

const banner = `/**
 * ${pkg.name} v${pkg.version}
 * ${new Date().toUTCString()} — git ${commit}
 * ${pkg.homepage}
 * @license ${pkg.license}
 * @author ${pkg.author.name}
 */`;

export default [{
  input: 'src/lib.ts',
  output: [{
    entryFileNames: 'lib.es6.js',
    format: 'es',
    dir: 'lib',
    banner,
  }, {
    entryFileNames: 'lib.cjs',
    format: 'cjs',
    dir: 'lib',
    banner,
  }],
  plugins: [
    typescript({ tsconfig: './tsconfig.es6.json' }),
    cleanup({
      comments: 'none',
      include: ['src/**/*.ts', 'node_modules/**'],
      extensions: ['ts', 'js'],
    }),
  ],
  external: ['tslib', 'uuid', 'child_process', 'net', 'path', 'fs'],
}];
