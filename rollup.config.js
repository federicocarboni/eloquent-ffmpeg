import typescript from '@rollup/plugin-typescript';

export default [{
  input: 'src/lib.ts',
  output: [{
    entryFileNames: 'lib.es6.js',
    format: 'es',
    dir: 'lib'
  }, {
    entryFileNames: 'lib.cjs',
    format: 'cjs',
    dir: 'lib'
  }],
  plugins: [
    typescript(),
  ]
}];
