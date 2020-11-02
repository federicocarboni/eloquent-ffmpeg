import { expect } from 'chai';

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
    describe('get pid()', function () {
      it('should return the process\' pid', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pid).to.be.a('number');
        expect(process.pid).to.equal(process.unwrap().pid);
      });
    });
    describe('kill()', function () {
      it('should send a signal to the process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.kill()).to.equal(true);
        expect(process.unwrap().killed).to.equal(true);
      });
    });
    describe('pause()', function () {
      (isWin32 ? it : it.skip)('should pause a process (Windows)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pause()).to.equal(true);
        expect(process.resume()).to.equal(true);
        process.unwrap().kill();
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).to.equal(false);
        expect(process.resume()).to.equal(false);
      });
      (!isWin32 ? it : it.skip)('should pause a process (SIGSTOP)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pause()).to.equal(true);
        expect(process.resume()).to.equal(true);
        expect(process.unwrap().killed).to.equal(true);
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).to.equal(false);
        expect(process.resume()).to.equal(false);
      });
    });
    describe('resume()', function () {
      (isWin32 ? it : it.skip)('should resume a process (Windows)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        expect(process.pause()).to.equal(true);
        expect(process.resume()).to.equal(true);
        process.unwrap().kill();
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).to.equal(false);
        expect(process.resume()).to.equal(false);
      });
      (!isWin32 ? it : it.skip)('should resume a process (SIGCONT)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        process.pause();
        expect(process.pause()).to.equal(true);
        expect(process.resume()).to.equal(true);
        expect(process.unwrap().killed).to.equal(true);
        await process.complete()
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          .catch(() => {});
        expect(process.pause()).to.equal(false);
        expect(process.resume()).to.equal(false);
      });
    });
    describe('abort()', function () {
      this.timeout(1000);
      it('should abort a running ffmpeg process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-f', 'matroska');
        const process = await cmd.spawn();
        await process.abort();
        await process.complete();
        expect(process.unwrap().exitCode).to.equal(0);
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
        expect(caught).to.equal(true);
      });
    });
    describe('complete()', function () {
      it('should resolve on completion', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
        expect(process.unwrap().exitCode).to.not.equal(null);
        await process.complete();
        expect(process.unwrap().exitCode).to.not.equal(null);
      });
      it('should reject on non-zero exit code', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'my_invalid_muxer');
        const process = await cmd.spawn();
        let caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(process.unwrap().exitCode).to.not.equal(null);
        expect(caught).to.equal(true);
        caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
      });
      it('should reject on non-zero exit code (invalid input)', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        let caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(process.unwrap().exitCode).to.not.equal(null);
        expect(caught).to.equal(true);
        caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
      });
      it('should reject on killed process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        process.unwrap().kill();
        let caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
        caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
      });
      it('should reject on errored process', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'my_invalid_muxer');
        const process = await cmd.spawn({
          ffmpegPath: './my_invalid_ffmpeg'
        });
        let caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(process.unwrap().exitCode).to.not.equal(null);
        expect(caught).to.equal(true);
        caught = false;
        try {
          await process.complete();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
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
          expect(progress.bitrate).to.be.a('number');
          expect(progress.bitrate).to.not.be.NaN;
          expect(progress.fps).to.be.a('number');
          expect(progress.fps).to.not.be.NaN;
          expect(progress.frames).to.be.a('number');
          expect(progress.frames).to.not.be.NaN;
          expect(progress.framesDropped).to.be.a('number');
          expect(progress.framesDropped).to.not.be.NaN;
          expect(progress.framesDuped).to.be.a('number');
          expect(progress.framesDuped).to.not.be.NaN;
          expect(progress.bytes).to.be.a('number');
          expect(progress.bytes).to.not.be.NaN;
          expect(progress.speed).to.be.a('number');
          expect(progress.speed).to.not.be.NaN;
          expect(progress.time).to.be.a('number');
          expect(progress.time).to.not.be.NaN;
        }
        await process.complete();
      });
    });
  });
});
