# Eloquent FFmpeg
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/FedericoCarboni/eloquent-ffmpeg.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/FedericoCarboni/eloquent-ffmpeg/context:javascript)
[![Known Vulnerabilities](https://snyk.io/test/github/FedericoCarboni/eloquent-ffmpeg/badge.svg?targetFile=package.json)](https://snyk.io/test/github/FedericoCarboni/eloquent-ffmpeg?targetFile=package.json)
[![tests](https://github.com/FedericoCarboni/eloquent-ffmpeg/actions/workflows/tests.yml/badge.svg)](https://github.com/FedericoCarboni/eloquent-ffmpeg/actions/workflows/tests.yml)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/FedericoCarboni/eloquent-ffmpeg)](https://codecov.io/gh/FedericoCarboni/eloquent-ffmpeg/branch/master)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FFedericoCarboni%2Feloquent-ffmpeg.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FFedericoCarboni%2Feloquent-ffmpeg?ref=badge_shield)

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
Eloquent FFmpeg requires a recent version of FFmpeg to be installed. Make sure that ffmpeg and
ffprobe executables are in `PATH`, or use the options `ffmpegPath` and `ffprobePath`.

**GitHub Actions**

To install FFmpeg on a GitHub Actions' runner use [FedericoCarboni/setup-ffmpeg](https://github.com/FedericoCarboni/setup-ffmpeg).

## Usage
Since most of Eloquent FFmpeg's methods are asynchronous it is advised to use
`async-await` to improve readability.

A simple example could use the following:

```ts
// Create a new command
const cmd = ffmpeg({
  // Include any options here...
});

// Select input(s)
cmd.input('input.mkv');
// ... and output(s)
cmd.output('output.mp4');

// Spawn ffmpeg as a child process
const proc = await cmd.spawn();
// Wait for the conversion to complete
await proc.complete();
```

### Streams
Streams can be used as input sources and output destinations, there is no hard
limit on how many streams can be used. Pass Node.js streams directly to
`FFmpegCommand.input()` and `FFmpegCommand.output()`.

Example using Node.js' `fs` module.
```ts
const cmd = ffmpeg();
cmd.input(fs.createReadStream('input.mkv'));
// The same output will be written to two destinations.
cmd.output(fs.createWriteStream('dest1.webm'), 'dest2.webm')
// When using streams the format must be explicitly specified
// because it can't be inferred from the file extension.
  .format('webm');

const proc = await cmd.spawn();
await proc.complete();
```

**Note:** Some formats require inputs and/or outputs to be seekable which means
that they cannot be used with streams, notable example being MP4. Some other
formats require a special format name to be explicitly set, for example to use
streams for GIF files the input format must be `gif_pipe`.

See [FFmpegCommand.input()](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegcommand.html#input) and [FFmpegCommand.output()](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegcommand.html#output)

### Concatenate Inputs
To concatenate inputs use `FFmpegCommand.concat()`, at the moment it is still unstable.

```ts
const cmd = ffmpeg();
cmd.concat(['file:input1.mkv', 'file:input2.mkv']);
cmd.output('output.mkv');

const proc = await cmd.spawn();
await proc.complete();
```

**Note:** When passing inputs to `FFmpegCommand.concat()` the protocol must be explicitly specified:
`file:` for example; streams are handled automatically. Sometimes it may be necessary to explicitly
enable certain protocols.

```ts
const cmd = ffmpeg();
cmd.concat(['file:input1.mkv', 'https://example.com/input2.mkv'], {
  protocols: ['file', 'tcp', 'tls', 'http', 'https'],
});
cmd.output('output.mkv');

const proc = await cmd.spawn();
await proc.complete();
```

See [FFmpegCommand.concat()](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegcommand.html#concat) and [ConcatOptions](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.concatoptions.html).

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

To set input and output options their `.args()` method can also be used.

```ts
const cmd = ffmpeg();
cmd.input('input.mp4')
  .args('-format', 'mp4');
cmd.output('output.mkv')
  .args('-codec:a', 'aac');
```

### Logging and Debugging
For debbugging, [`FFmpegCommand.spawn()`](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegcommand.html#spawn)'s [options](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.spawnoptions.html) accept [`logger`](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.spawnoptions.html#logger) and [`report`](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.spawnoptions.html#report).

The `report` option dumps the full command line arguments and logs to the specified file or, when
not specified, FFmpeg will create a file named `ffmpeg-YYYYMMDD-HHMMSS.log` in its current
directory. When the log level is not specified FFmpeg defaults to `LogLevel.Debug`.

See [`-loglevel` and `-report` in FFmpeg's docs](https://ffmpeg.org/ffmpeg-all.html#Generic-options).

```ts
const cmd = ffmpeg({
  level: LogLevel.Warning,
});
cmd.input('input.mkv');
cmd.output('output.mp4');

const proc = await cmd.spawn({
  // Enable logger and report when not in production mode.
  logger: process.env.NODE_ENV !== 'production' && {
    warning: (message) => {
      console.warn('FFmpeg warning:', message);
    },
  },
  report: process.env.NODE_ENV !== 'production' && {
    file: 'ffmpeg-123.log',
    level: LogLevel.Debug,
  },
});
await proc.complete();
```

### Controlling the conversion
Make sure to check [the API documentation for FFmpegProcess](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.ffmpegprocess.html).

#### Monitor progress
To receive real-time updates on the conversion's progress, use the `FFmpegProcess.progress()` method.
It returns an async generator of [Progress](https://federicocarboni.github.io/eloquent-ffmpeg/api/interfaces/_src_lib_.progress.html).
```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const proc = await cmd.spawn();
for await (const { speed, time } of proc.progress()) {
  console.log(`Converting @ ${speed}x – ${time}/${TOTAL_TIME}`);
}
// NOTE: The progress generator will return when ffmpeg writes a
// `progress=end` line, which signals the end of progress updates,
// not the conversion's completion.
// Use proc.complete() to wait for completion.
await proc.complete();
console.log('Hooray! Conversion complete!');
```
To use Node.js' streams, `FFmpegProcess.progress()` can be turned into a Node.js readable stream
using `Readable.from()`.
```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const proc = await cmd.spawn();
const progress = Readable.from(proc.progress());
progress.on('data', ({ speed, time }) => {
  console.log(`Converting @ ${speed}x – ${time}/${TOTAL_TIME}`);
});
progress.on('end', () => {
  // NOTE: The progress stream will end when ffmpeg writes a
  // `progress=end` line, which signals the end of progress
  // updates, not the conversion's completion.
  console.log('No more progress updates');
});
// Use proc.complete() to wait for completion.
await proc.complete();
console.log('Hooray! Conversion complete!');
```
**Tracking progress as a percentage:** To get a percentage from the progress the total
duration of the media must be known, this is very easy if the duration is not modified.

Probe the input file and calculate the percentage by dividing the current `time` by the `duration`
and multiplying by 100.

```ts
const cmd = ffmpeg();
const input = cmd.input('input.mkv');
const info = await input.probe();
cmd.output('video.mp4');
const proc = await cmd.spawn();
for await (const { speed, time } of proc.progress()) {
  console.log(`Converting @ ${speed}x – ${time / info.duration * 100}%`);
}
await proc.complete();
console.log('Hooray! Conversion complete!');
```

#### Pause and Resume
The conversion can be paused and resumed using `FFmpegProcess.pause()`
and `FFmpegProcess.resume()`. Both methods are synchronous, they return `true`
upon success, `false` otherwise.

**Note:** On Windows this requires the optional dependency
[ntsuspend](https://www.npmjs.com/package/ntsuspend) to be installed.

```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const proc = await cmd.spawn();
// Pause the conversion
proc.pause();
// Resume...
proc.resume();

await proc.complete();
```

#### Abort
The conversion can be terminated early using `FFmpegProcess.abort()`, this
gracefully interrupts the conversion allowing FFmpeg to end the file correctly.
The method is asynchronous.

**Note:** `abort()` resolves when FFmpeg exits, but it doesn't guarantee that it
will exit successfully, any possible errors should be handled explicitly.

```ts
const cmd = ffmpeg();
cmd.input('input.mkv');
cmd.output('output.mp4');
const proc = await cmd.spawn();
await proc.abort();
```

## Errors
### FFmpeg exited with code x
<!-- https://git.io/JTqA9#ffmpeg-exited-with-code-x -->
FFmpeg exited with a non-zero status code, which means that the conversion
failed. This typically occurs because of a corrupt input or a wrong
configuration. See [Logging and Debugging](#logging-and-debugging).

### FFmpeg exited prematurely
<!-- https://git.io/JTqA9#ffmpeg-exited-prematurely -->
FFmpeg exited without a status code. This typically means that the conversion
was forcefully terminated (or that an error occurred in a system call).
See [Logging and Debugging](#logging-and-debugging).

### Cannot import ntsuspend
<!-- https://git.io/JTqA9#cannot-import-ntsuspend -->
This error is likely caused by a corrupt or missing installation of [ntsuspend](https://www.npmjs.com/package/ntsuspend).
`ntsuspend` is required to pause and resume the FFmpeg child process on Windows.
Try to uninstall and reinstall `ntsuspend`, and if you experience further
problems open a new issue to get help.

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FFedericoCarboni%2Feloquent-ffmpeg.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FFedericoCarboni%2Feloquent-ffmpeg?ref=badge_large)
