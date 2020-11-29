'use strict';
const path = require('path');

/** @type {import('webpack').Configuration} */
const config = {
  mode: 'production',
  entry: './index.mjs',
  output: {
    path: path.join(process.cwd(), 'build'),
    filename: 'index-webpack.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [{
      test: /\.node$/,
      use: {
        loader: '@zeit/webpack-asset-relocator-loader',
        options: {
          production: true,
        },
      },
    }],
  },
  optimization: {
    minimize: false,
  },
  target: 'node',
};

module.exports = config;
