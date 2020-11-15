# Eloquent FFmpeg
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/FedericoCarboni/eloquent-ffmpeg.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/FedericoCarboni/eloquent-ffmpeg/context:javascript)
[![Known Vulnerabilities](https://snyk.io/test/github/FedericoCarboni/eloquent-ffmpeg/badge.svg?targetFile=package.json)](https://snyk.io/test/github/FedericoCarboni/eloquent-ffmpeg?targetFile=package.json)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/FedericoCarboni/eloquent-ffmpeg)](https://codecov.io/gh/FedericoCarboni/eloquent-ffmpeg/branch/master)

Eloquent FFmpeg simplifies interactions with
[FFmpeg's command line tools](https://ffmpeg.org/) into a simple yet powerful API.
This library is fully typed, so in editors such as VS Code, intellisense should help you get started.
You may also want to [view the API documentation](https://federicocarboni.github.io/eloquent-ffmpeg/api/globals.html)
or [`examples/`](https://github.com/FedericoCarboni/eloquent-ffmpeg/tree/master/examples).

If something is missing or doesn't feel right, feel free to open an issue or a
pull request to change it. This library is still in a very early stage, but
there shouldn't be any major breaking changes.

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
that they cannot be used with streams, notable example being MP4. Some other
formats require a special format name to be explicitly set, for example to use
streams for GIF files the input format must be `gif_pipe`.

### Input & Output Options

Eloquent FFmpeg exposes a few methods which act as a shortcut to set a few
options. See [FFmpegInput](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpeginput.html)
and [FFmpegOutput](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegoutput.html)

```ts
const cmd = ffmpeg();
cmd.input('input.mp4')
  .format('mp4');
cmd.output('output.mkv')
  .audioCodec('aac');
```

To set input and output options you could also use their `.args()` method.

```ts
const cmd = ffmpeg();
cmd.input('input.mp4')
  .args('-format', 'mp4');
cmd.output('output.mkv')
  .args('-codec:a', 'aac');
```

### Controlling your conversion
Make sure to check [the API documentation for FFmpegProcess](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegprocess.html).
#### Monitor progress
To receive real-time updates on your conversion's progress, use the `FFmpegProcess.progress()` method.
It returns an async generator of [Progress](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.progress.html).
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
**Tracking progress as a percentage:** To get a percentage from the progress you must know the total
duration of the media, this is very easy if the duration is not modified.

Probe the input file and calculate the percentage by dividing the current `time` by the `duration`
and multiplying by 100.

```ts
const cmd = ffmpeg();
const input = cmd.input('input.mkv');
const info = await input.probe();
cmd.output('video.mp4');
const process = await cmd.spawn();
for await (const { speed, time } of process.progress()) {
  console.log(`Converting @ ${speed}x – ${time / info.duration * 100}%`);
}
await process.complete();
console.log('Hooray! Conversion complete!');
```

#### Pause & Resume
The conversion can be paused and resumed using `FFmpegProcess.pause()`
and `FFmpegProcess.resume()`. Both methods are synchronous, they return `true`
upon success, `false` otherwise.

**Note:** On Windows this requires the optional dependency
[ntsuspend](https://www.npmjs.com/package/ntsuspend) to be installed.

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

#### Abort
The conversion can be terminated early using `FFmpegProcess.abort()`, this
gracefully interrupts the conversion allowing FFmpeg to end the file correctly.
The method is asynchronous so you have to `await` it.

**Note:** `abort()` resolves when FFmpeg exits, but it doesn't guarantee that it
will exit successfully, any possible errors should be handled explicitly.

```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const process = await cmd.spawn();
await process.abort();
```

## Errors
### Error ntsuspend
This error is likely caused by a corrupt or missing installation of [ntsuspend](https://www.npmjs.com/package/ntsuspend),
required to pause and resume the process on Windows. Try to uninstall and
reinstall ntsuspend, and if you experience further issues open a new issue to
get help.
