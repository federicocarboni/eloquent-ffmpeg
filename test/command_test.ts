import { PassThrough, Readable } from 'stream';
import { createReadStream, promises, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { expect } from 'chai';

import { ffmpeg } from '../src/command';
import { isWin32 } from '../src/utils';

describe('command', function () {
  describe('FFmpegCommand', function () {
    this.timeout(30000);
    describe('input()', function () {
      it('should add a string as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input('protocol:location');
        expect(input.isStream).to.equal(false);
        expect(input.getArgs().pop()).to.equal('protocol:location');
      });
      it('should add a short buffer as source', function () {
        const cmd = ffmpeg();
        const input1 = cmd.input(randomBytes(4096));
        const input2 = cmd.input(randomBytes(4096).buffer);
        expect(input1.isStream).to.equal(false);
        expect(input2.isStream).to.equal(false);
      });
      it('should add a long buffer as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input(randomBytes(16385));
        expect(input.isStream).to.equal(true);
      });
      it('should add an iterable as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input([randomBytes(4096)]);
        expect(input.isStream).to.equal(true);
      });
      it('should add an async iterable as source', function () {
        async function* asyncIterable() { yield randomBytes(4906); }
        const cmd = ffmpeg();
        const input = cmd.input(asyncIterable());
        expect(input.isStream).to.equal(true);
      });
      it('should add a NodeJS.ReadableStream as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input(Readable.from([randomBytes(4096)]));
        expect(input.isStream).to.equal(true);
      });
    });
    describe('output()', function () {
      it('should add a string as destination', function () {
        const cmd = ffmpeg();
        const input = cmd.output('protocol:location');
        expect(input.isStream).to.equal(false);
        expect(input.getArgs().pop()).to.equal('protocol:location');
      });
      it('should add a async generator as destination', function () {
        async function* asyncGenerator() { yield; }
        const cmd = ffmpeg();
        const input = cmd.output(asyncGenerator());
        expect(input.isStream).to.equal(true);
      });
      it('should add multiple mixed destinations', function () {
        async function* asyncGenerator() { yield; }
        const cmd = ffmpeg();
        const input = cmd.output('protocol:location', asyncGenerator());
        const lastArg = input.getArgs().pop();
        expect(input.isStream).to.equal(true);
        expect(lastArg).to.be.a('string');
        expect(lastArg!.startsWith('tee:')).to.equal(true);
      });
    });
    describe('args()', function () {
      it('should return this', function () {
        const cmd = ffmpeg();
        expect(cmd.args()).to.equal(cmd);
      });
      it('should push arguments to the start of the command', async function () {
        const cmd = ffmpeg();
        expect(cmd.args()).to.equal(cmd);
      });
    });
    describe('spawn()', function () {
      it('should handle a simple output destination', async function () {
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output('test/samples/[strange]output.mkv')
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          await process.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).to.equal(true);
        } finally {
          try {
            unlinkSync('test/samples/[strange]output.mkv');
          } catch {
            //
          }
        }
      });
      it('should handle simple output destinations', async function () {
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output('test/samples/output.mkv', 'test/samples/[strange]output.mkv')
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          await process.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).to.equal(true);
          expect((await promises.lstat('test/samples/output.mkv')).isFile()).to.equal(true);
        } finally {
          try {
            unlinkSync('test/samples/[strange]output.mkv');
            unlinkSync('test/samples/output.mkv');
          } catch {
            //
          }
        }
      });
      it('should handle a single streaming output destination', async function () {
        async function* handleOutput() {
          while (true) {
            expect(yield).to.be.an.instanceOf(Uint8Array);
          }
        }
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(handleOutput())
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle multiple streaming output destinations', async function () {
        async function* handleOutput1() {
          while (true) {
            expect(yield).to.be.an.instanceOf(Uint8Array);
          }
        }
        async function* handleOutput2() {
          while (true) {
            expect(yield).to.be.an.instanceOf(Uint8Array);
          }
        }
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(handleOutput1(), handleOutput2(), new PassThrough())
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle multiple streaming outputs', async function () {
        async function* handleOutput1() {
          while (true) {
            expect(yield).to.be.an.instanceOf(Uint8Array);
          }
        }
        async function* handleOutput2() {
          while (true) {
            expect(yield).to.be.an.instanceOf(Uint8Array);
          }
        }
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(handleOutput1())
          .args('-c', 'copy', '-f', 'matroska');
        cmd.output(handleOutput2())
          .args('-c', 'copy', '-f', 'matroska');
        cmd.output(new PassThrough())
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle null outputs', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle a single streaming input source', async function () {
        const cmd = ffmpeg();
        cmd.input(createReadStream('test/samples/video.mp4'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle multiple streaming inputs', async function () {
        const cmd = ffmpeg();
        cmd.input(createReadStream('test/samples/video.mp4'));
        cmd.input(createReadStream('test/samples/video.mkv'));
        cmd.output()
          .args('-map', '0:0', '-map', '1:1', '-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle simple inputs', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
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
          expect(process.kill()).to.be.a('boolean');
          expect(process.unwrap().killed).to.equal(true);
        });
      });
      describe('pause()', function () {
        if (isWin32) it('should fail on Windows', async function () {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output()
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          expect(() => process.pause()).to.throw();
          process.kill();
        });
      });
      describe('resume()', function () {
        if (isWin32) it('should fail on Windows', async function () {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output()
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          expect(() => process.resume()).to.throw();
          process.kill();
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
        });
      });
      describe('progress()', function () {
        it('should return an async generator of Progress', async function () {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output()
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          for await (const progress of process.progress()) {
            expect(progress.bitrate).to.be.a('number');
            expect(progress.fps).to.be.a('number');
            expect(progress.frames).to.be.a('number');
            expect(progress.framesDropped).to.be.a('number');
            expect(progress.framesDuped).to.be.a('number');
            expect(progress.size).to.be.a('number');
            expect(progress.speed).to.be.a('number');
            expect(progress.time).to.be.a('number');
          }
          await process.complete();
          expect(process.unwrap().exitCode).to.be.a('number');
        });
      });
    });
  });
});
