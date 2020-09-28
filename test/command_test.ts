import { PassThrough, Readable } from 'stream';
import { createReadStream, promises, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { expect } from 'chai';

import { ffmpeg } from '../src/command';

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
          await process.wait();
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
          await process.wait();
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
        await process.wait();
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
        await process.wait();
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
        await process.wait();
      });
      it('should handle null outputs', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.wait();
      });
      it('should handle a single streaming input source', async function () {
        const cmd = ffmpeg();
        cmd.input(createReadStream('test/samples/video.mp4'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.wait();
      });
      it('should handle multiple streaming inputs', async function () {
        const cmd = ffmpeg();
        cmd.input(createReadStream('test/samples/video.mp4'));
        cmd.input(createReadStream('test/samples/video.mkv'));
        cmd.output()
          .args('-map', '0:0', '-map', '1:1', '-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.wait();
      });
      it('should handle simple inputs', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.wait();
      });
    });
  });
});
