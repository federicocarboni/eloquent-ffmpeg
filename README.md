# Eloquent FFmpeg
Eloquent FFmpeg simplifies interactions with
[FFmpeg's command line tools](https://ffmpeg.org/) into a simple yet powerful API.
This library is fully typed, so in editors such as VS Code, intellisense should help you get started.
You may also want to [view the documentation](https://federicocarboni.github.io/eloquent-ffmpeg/).

If something doesn't feel right, feel free to open an issue or a pull request to
change it. This library is still in a very early stage, but there shouldn't be
any major breaking changes.

**Only NodeJS 10.x or higher is supported**

## Prerequisites
Eloquent FFmpeg must know where to find your `ffmpeg` or `ffprobe` executables,
you can use the environment variables `FFMPEG_PATH` and `FFPROBE_PATH`, pointing
to the `ffmpeg` and `ffprobe` executables respectively.
To set the path programmatically use `setFFmpegPath()` or `setFFprobePath()`.
```ts
import { setFFmpegPath, setFFprobePath } from 'eloquent-ffmpeg';

setFFmpegPath('/path/to/your/ffmpeg');
setFFprobePath('/path/to/your/ffprobe');
```
**Note:** Eloquent FFmpeg will not search your `PATH`, if you want to search the
executables use [node which](https://github.com/npm/node-which), which mimics
unix operating systems' `which` command.

`npm install --save which`
```ts
import { setFFmpegPath, setFFprobePath } from 'eloquent-ffmpeg';
import which from 'which';

setFFmpegPath(which.sync('ffmpeg'));
setFFprobePath(which.sync('ffprobe'));
```

## Usage
Since most of Eloquent FFmpeg's methods are asynchronous it is advised to use
`async-await` to make your code more readable.

A simple example could use the following:

```ts
// create a new command
const cmd = ffmpeg({
  // include any options here...
});

// select your input(s)
cmd.input('input.mkv');
// ... and your output(s)
cmd.output('output.mp4');

// spawn ffmpeg as a child process
const process = await cmd.spawn();
// wait for the conversion to complete
await process.complete();
```

### Streams
Streams can be used as input sources and output destinations, there is no hard
limit on how many streams you can use. Pass your streams directly to
`FFmpegCommand.input()` and `FFmpegCommand.output()`.

Example using NodeJS' `fs` module.
```ts
const cmd = ffmpeg();
cmd.input(fs.createReadStream('input.mkv'));
// The same output will be written to two destinations.
cmd.output(fs.createWriteStream('dest1.webm'), 'dest2.webm');

const process = await cmd.spawn();
await process.complete();
```

**Note:** Some formats require inputs and/or outputs to be seekable which means
that they cannot be used with streams, notable example being MP4. Other formats
require a special format name to be explicitly set, for example to use streams
for GIF files the input format must be `gif_pipe`.

### Input & Output Options

Eloquent FFmpeg exposes a few methods which act as a shortcut to set a few
options. See [FFmpegInput](https://federicocarboni.github.io/eloquent-ffmpeg/interfaces/_command_.ffmpeginput.html)
and [FFmpegOutput](https://federicocarboni.github.io/eloquent-ffmpeg/interfaces/_command_.ffmpegoutput.html)

```ts
const cmd = ffmpeg();
cmd.input('input.mp4')
  .format('mp4');
cmd.output('output.webm')
  .audioCodec('aac');
```

To set input and output options you could also use their `.args()` method.

```ts
const cmd = ffmpeg();
cmd.input('input.mp4')
  .args('-format', 'mp4');
cmd.output('output.webm')
  .args('-codec:a', 'aac');
```

### Controlling your conversion
#### Monitor progress
To receive real-time updates on your conversion's progress, use the `FFmpegProcess.progress()` method.
See [Progress interface](https://federicocarboni.github.io/eloquent-ffmpeg/interfaces/_command_.progress.html).
```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const process = await cmd.spawn();
for await (const { speed, time } of process.progress()) {
  console.log(`Converting @ ${speed}x – ${time}/${TOTAL_TIME}`);
}
// NOTE: The progress generator will return when ffmpeg writes a
// `progress=end` line, which signals the end of progress updates,
// not the conversion's completion.
// Use process.complete() to wait for completion.
await process.complete();
console.log('Hooray! Conversion complete!');
```
If you want to use NodeJS' streams, turn `FFmpegProcess.progress()` into a
NodeJS readable stream using `Readable.from()`.
```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const process = await cmd.spawn();
const progress = Readable.from(process.progress());
progress.on('data', ({ speed, time }) => {
  console.log(`Converting @ ${speed}x – ${time}/${TOTAL_TIME}`);
});
progress.on('end', () => {
  // NOTE: The progress stream will end when ffmpeg writes a
  // `progress=end` line, which signals the end of progress
  // updates, not the conversion's completion.
  console.log('No more progress updates');
});
// Use process.complete() to wait for completion.
await process.complete();
console.log('Hooray! Conversion complete!');
```

#### Pause & Resume
The conversion can be paused and resumed using `FFmpegProcess.pause()`
and `FFmpegProcess.resume()`. Both methods are synchronous, they return `true` if they succeeded `false` otherwise.

These methods are currently **NOT** supported on Windows, support is planned.

```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const process = await cmd.spawn();
// Pause the conversion
process.pause();
// Resume...
process.resume();

await process.complete();
```
