# Eloquent FFmpeg
Eloquent FFmpeg simplifies interactions with
[FFmpeg's command line tools](https://ffmpeg.org/) into a simple yet powerful API.

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
**Note** Eloquent FFmpeg will not search your `PATH`, if you want to search the
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
`async-await` to make your code more readable. To view the library in detail
view the [full documentation](https://federicocarboni.github.io/eloquent-ffmpeg/).

A simple example could use the following:

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

### Streams
Streams can be used as input sources and output destinations, there is no hard limit on how many streams you can use. Pass your streams directly to `FFmpegCommand.input()` and `FFmpegCommand.output()`.
`FFmpegCommand.input()` can also take `BufferLike` objects.

Example using NodeJS' `fs` module.
```ts
const cmd = ffmpeg();
cmd.input(fs.createReadStream('input.mkv'));
// The same output will be written to two destinations.
cmd.output(fs.createWriteStream('output1.avi'), 'output2.avi');

const process = await cmd.spawn();
await process.complete();
```

### Monitor progress
To receive real-time updates on your conversion's progress, use the `FFmpegProcess.progress()` method.

```ts
const cmd = ffmpeg();
cmd.input('input.avi');
cmd.output('output.mp4');
const process = await cmd.spawn();
for await (const { speed, time } of process.progress()) {
  console.log(`Converting @ ${speed}x – ${time}/${TOTAL_TIME}`);
}
// Be careful! The progress generator will return when ffmpeg writes
// a `progress=end` line, which signals the end of progress updates,
// not the conversion's completion.
// Use process.complete() to wait for completion.
await process.complete();
console.log('Hooray! Conversion complete!');
```
If you want to use NodeJS' streams, turn `FFmpegProcess.progress()` into a `ReadableStream` using `Readable.from()`.
```ts
const process = await cmd.spawn();
const progress = Readable.from(process.progress());
progress.on('data', ({ speed, time }) => {
  console.log(`Converting @ ${speed}x – ${time}/${TOTAL_TIME}`);
});
progress.on('end', () => {
  // Be careful! The progress stream will end when ffmpeg writes
  // a `progress=end` line, which signals the end of progress updates,
  // not the conversion's completion.
  console.log('No more progress updates');
});
// Use process.complete() to wait for completion.
process.complete().then(() => console.log('Hooray! Conversion complete!'));
```
