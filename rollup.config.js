import typescript from '@rollup/plugin-typescript';
import { execSync } from 'child_process';
import pkg from './package.json';

const commit = execSync('git rev-parse HEAD').toString('utf-8').slice(0, -1);

const banner = `/**
 * ${pkg.name} v${pkg.version}
 * ${new Date().toUTCString()}
 * Commit ${commit}
 * ${pkg.homepage}
 * @author ${pkg.author.name}
 * @license ${pkg.license}
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
  ],
  external: ['child_process', 'path', 'fs'],
}];
