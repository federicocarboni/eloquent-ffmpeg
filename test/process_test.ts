import { ffmpeg } from '../src/command';
import { FFmpegError } from '../src/lib';
import { spawn } from '../src/process';
import { isWin32 } from '../src/utils';

describe('process', function () {
  describe('spawn()', function () {
    it('should spawn ffmpeg as a child process', async function () {
      const process = spawn(['-y', '-i', 'test/samples/video.mkv', '-c', 'copy', '-f', 'null', '-']);
      await process.complete();
    });
  });
  describe('FFmpegProcess', function () {
    describe('get pid()', function () {
      it('should return the process\' pid', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(typeof process.pid).toBe('number');
        expect(process.pid).toBe(process.unwrap().pid);
      });
    });
    describe('kill()', function () {
      it('should send a signal to the process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.kill()).toBe(true);
        expect(process.unwrap().killed).toBe(true);
      });
    });
    describe('pause()', function () {
      (isWin32 ? it : it.skip)('should pause a process (Windows)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pause()).toBe(true);
        expect(process.resume()).toBe(true);
        process.unwrap().kill();
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).toBe(false);
        expect(process.resume()).toBe(false);
      });
      (!isWin32 ? it : it.skip)('should pause a process (SIGSTOP)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pause()).toBe(true);
        expect(process.resume()).toBe(true);
        expect(process.unwrap().killed).toBe(true);
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).toBe(false);
        expect(process.resume()).toBe(false);
      });
    });
    describe('resume()', function () {
      (isWin32 ? it : it.skip)('should resume a process (Windows)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pause()).toBe(true);
        expect(process.resume()).toBe(true);
        process.unwrap().kill();
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).toBe(false);
        expect(process.resume()).toBe(false);
      });
      (!isWin32 ? it : it.skip)('should resume a process (SIGCONT)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        process.pause();
        expect(process.pause()).toBe(true);
        expect(process.resume()).toBe(true);
        expect(process.unwrap().killed).toBe(true);
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).toBe(false);
        expect(process.resume()).toBe(false);
      });
    });
    describe('abort()', function () {
      it('should abort a running ffmpeg process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-f', 'matroska');
        const process = await cmd.spawn();
        await process.abort();
        expect(process.unwrap().exitCode).toBe(0);
      });
      it('should reject on a non-running ffmpeg process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .codec('copy')
          .format('matroska');
        const process = await cmd.spawn();
        await process.complete();
        let caught = false;
        try {
          await process.abort();
        } catch {
          caught = true;
        }
        expect(caught).toBe(true);
      });
    });
    describe('complete()', function () {
      it('should resolve on completion', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await expect(process.complete()).resolves.toBeUndefined();
        expect(process.unwrap().exitCode).toBe(0);
        await expect(process.complete()).resolves.toBeUndefined();
      });
      it('should reject on non-zero exit code', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        process.complete().then(console.log, console.log);
        await expect(process.complete()).rejects.toThrow(FFmpegError);
        await expect(process.complete()).rejects.toThrow(FFmpegError);
      });
      it('should reject on killed process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        process.unwrap().kill();
        await expect(process.complete()).rejects.toThrow(FFmpegError);
        await expect(process.complete()).rejects.toThrow(FFmpegError);
      });
      it('should reject on errored process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output();
        const process = await cmd.spawn({
          ffmpegPath: './my_invalid_ffmpeg'
        });
        process.complete().catch(console.log);
        await expect(process.complete()).rejects.toThrow();
        await expect(process.complete()).rejects.toThrow();
      });
      it('should resolve on completion after process exit', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await new Promise((resolve) => process.unwrap().on('exit', resolve));
        await expect(process.complete()).resolves.toBeUndefined();
        await expect(process.complete()).resolves.toBeUndefined();
      });
      it('should reject on error after process exit', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await new Promise((resolve) => process.unwrap().on('exit', resolve));
        await expect(process.complete()).rejects.toThrow();
        await expect(process.complete()).rejects.toThrow();
      });
    });
    describe('progress()', function () {
      it('should return an async generator of Progress', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c:a', 'aac', '-c:v', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        for await (const progress of process.progress()) {
          expect(typeof progress.bitrate).toBe('number');
          expect(progress.bitrate).not.toBeNaN();
          expect(typeof progress.fps).toBe('number');
          expect(progress.fps).not.toBeNaN();
          expect(typeof progress.frames).toBe('number');
          expect(progress.frames).not.toBeNaN();
          expect(typeof progress.framesDropped).toBe('number');
          expect(progress.framesDropped).not.toBeNaN();
          expect(typeof progress.framesDuped).toBe('number');
          expect(progress.framesDuped).not.toBeNaN();
          expect(typeof progress.bytes).toBe('number');
          expect(progress.bytes).not.toBeNaN();
          expect(typeof progress.speed).toBe('number');
          expect(progress.speed).not.toBeNaN();
          expect(typeof progress.time).toBe('number');
          expect(progress.time).not.toBeNaN();
        }
        await process.complete();
      });
    });
  });
});
