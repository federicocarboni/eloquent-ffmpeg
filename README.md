# Eloquent FFmpeg
Eloquent FFmpeg simplifies interactions with
[FFmpeg's command line tools](https://ffmpeg.org/) into a simple yet powerful API.

If something doesn't feel right, feel free to open an issue or a pull request to change it.
This library is still in a very early stage, but there should be no breaking changes.

**Only NodeJS 10.x or higher is supported**

## Prerequisites
Eloquent FFmpeg must know where to find your `ffmpeg` and/or `ffprobe` executables, you can set the environment variables `FFMPEG_PATH` and `FFPROBE_PATH`, or set the path programmatically using `setFFmpegPath()` and `setFFprobePath()`.
```ts
import { setFFmpegPath, setFFprobePath } from 'eloquent-ffmpeg';

setFFmpegPath('/path/to/your/ffmpeg');
setFFprobePath('/path/to/your/ffprobe');
```
You can use it in conjunction with [node which](https://github.com/npm/node-which) to search for `ffmpeg` in `PATH`.

`npm install --save which`
```ts
import { setFFmpegPath } from 'eloquent-ffmpeg';
import which from 'which';

setFFmpegPath(which.sync('ffmpeg'));
```

## Usage
Since most of Eloquent FFmpeg's methods are asynchronous it is advised to use
`async-await` to make your code more readable.

A simple example would use the following code:

```ts
// create a new command
const cmd = ffmpeg({
  // include any options here...
});

// select your input(s)
cmd.input('input.avi');
// ... and your output(s)
cmd.output('output.mp4');

// spawn ffmpeg as a child process
const process = await cmd.spawn();
// wait for the conversion to complete
await process.complete();
```
