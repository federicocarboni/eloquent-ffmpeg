import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { getFFmpegPath } from '../src/env';
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';

if (!existsSync('test/samples')) mkdirSync('test/samples');

console.log('Generating videos for testing, this may take a while...');

writeFileSync('test/samples/invalid', randomBytes(1363148));

const { status } = spawnSync(getFFmpegPath(), [
  '-y',
  '-f', 'lavfi', '-i', 'testsrc=duration=60:size=1280x720',
  '-f', 'lavfi', '-i', 'sine=duration=60:frequency=1000:sample_rate=44100',

  '-c:v', 'libx264', '-profile:v', 'high', '-vf', 'format=yuv420p',
  '-c:a', 'aac',
  'test/samples/video.mp4',

  '-c:v', 'libx264', '-profile:v', 'high', '-vf', 'format=yuv420p',
  '-c:a', 'aac',
  'test/samples/video.mkv',

  '-c:v', 'libvpx', '-vf', 'format=yuv420p',
  '-c:a', 'libopus',
  'test/samples/video.webm'
]);

if (status !== 0) console.log(`FFmpeg exited with code ${status}`);

process.exit(status!);
