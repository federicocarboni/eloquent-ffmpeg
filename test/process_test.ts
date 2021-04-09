import { ffmpeg } from '../src/command';
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
    describe('pause()', function () {
      (isWin32 ? it : it.skip)('should pause a process (Windows)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        expect(proc.pause()).toBe(true);
        expect(proc.resume()).toBe(true);
        proc.unwrap().kill();
        await proc.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(proc.pause()).toBe(false);
        expect(proc.resume()).toBe(false);
      });
      (!isWin32 ? it : it.skip)('should pause a process (SIGSTOP)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        expect(proc.pause()).toBe(true);
        expect(proc.resume()).toBe(true);
        expect(proc.unwrap().killed).toBe(true);
        await proc.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(proc.pause()).toBe(false);
        expect(proc.resume()).toBe(false);
      });
    });
    describe('resume()', function () {
      (isWin32 ? it : it.skip)('should resume a process (Windows)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        expect(proc.pause()).toBe(true);
        expect(proc.resume()).toBe(true);
        proc.unwrap().kill();
        await proc.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(proc.pause()).toBe(false);
        expect(proc.resume()).toBe(false);
      });
      (!isWin32 ? it : it.skip)('should resume a process (SIGCONT)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        proc.pause();
        expect(proc.pause()).toBe(true);
        expect(proc.resume()).toBe(true);
        expect(proc.unwrap().killed).toBe(true);
        await proc.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(proc.pause()).toBe(false);
        expect(proc.resume()).toBe(false);
      });
    });
    describe('abort()', function () {
      it('should abort a running ffmpeg process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-f', 'matroska');
        const proc = await cmd.spawn();
        await proc.abort();
        expect(proc.unwrap().exitCode).toBe(0);
      });
      it('should reject on a non-running ffmpeg process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .codec('copy')
          .format('matroska');
        const proc = await cmd.spawn();
        await proc.complete();
        let caught = false;
        try {
          await proc.abort();
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
        const proc = await cmd.spawn();
        await expect(proc.complete()).resolves.toBeUndefined();
        expect(proc.unwrap().exitCode).toBe(0);
        await expect(proc.complete()).resolves.toBeUndefined();
      });
      it('should reject on non-zero exit code', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        await expect(proc.complete()).rejects.toThrow();
        await expect(proc.complete()).rejects.toThrow();
      });
      it('should reject on killed process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        proc.unwrap().kill();
        await expect(proc.complete()).rejects.toThrow();
        await expect(proc.complete()).rejects.toThrow();
      });
      it('should reject on errored process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output();
        const proc = await cmd.spawn({
          ffmpegPath: './my_invalid_ffmpeg'
        });
        await expect(proc.complete()).rejects.toThrow();
        await expect(proc.complete()).rejects.toThrow();
      });
      it('should resolve on completion after process exit', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        await new Promise((resolve) => proc.unwrap().on('exit', resolve));
        await expect(proc.complete()).resolves.toBeUndefined();
        await expect(proc.complete()).resolves.toBeUndefined();
      });
      it('should reject on error after process exit', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        await new Promise((resolve) => proc.unwrap().on('exit', resolve));
        await expect(proc.complete()).rejects.toThrow();
        await expect(proc.complete()).rejects.toThrow();
      });
    });
    describe('progress()', function () {
      it('should return an async generator of Progress', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c:a', 'aac', '-c:v', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        for await (const progress of proc.progress()) {
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
          expect(typeof progress.size).toBe('number');
          expect(progress.size).not.toBeNaN();
          expect(typeof progress.speed).toBe('number');
          expect(progress.speed).not.toBeNaN();
          expect(typeof progress.time).toBe('number');
          expect(progress.time).not.toBeNaN();
        }
        await proc.complete();
      });
    });
  });
});
