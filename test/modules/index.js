'use strict';
const { ffmpeg } = require('eloquent-ffmpeg');
if (typeof ffmpeg !== 'function') throw new TypeError('ffmpeg is not a function');
