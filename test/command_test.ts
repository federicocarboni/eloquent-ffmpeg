import { expect } from 'chai';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
// import { createReadStream, createWriteStream } from 'fs';
import { ffmpeg } from '../src/command';
// import { write } from '../src/utils';
// import { read } from '../src/utils';
// const writeStream = createWriteStream('video1.mp4');
// const writeStream2 = createWriteStream('video2.mp4');

// async function* createNewWriteStream() {
//   while (true) {
//     const chunk = yield;
//     console.log(chunk.length);
//     await write(writeStream2, chunk)
//       .then(() => { console.log('Written ', chunk.length); });
//   }
// }

describe('command', function () {
  this.timeout(60000);
  describe('FFmpegCommand', function () {
    describe('input()', function () {
      it('should add a string as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input('protocol:location');
        expect(input.isStream).to.equal(false);
        expect(input.getArgs().pop()).to.equal('protocol:location');
      });
      it('should add a short buffer as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input(randomBytes(4096));
        expect(input.isStream).to.equal(false);
        expect(input.getArgs().pop()!.startsWith('data:application/octet-stream;base64,')).to.equal(true);
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
    describe('spawn()', function () {
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
        cmd.output(handleOutput1(), handleOutput2())
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
        const process = await cmd.spawn();
        await process.wait();
      });
    });
  });
});
