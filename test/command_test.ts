import { createReadStream, createWriteStream, promises, unlinkSync } from 'fs';
import { PassThrough, Readable } from 'stream';
import { expect } from 'chai';

import { ffmpeg, LogLevel } from '../src/command';
import { isWin32 } from '../src/utils';

describe('command', function () {
  describe('ffmpeg()', function () {
    this.timeout(30000);
    it('should set ffmpeg\'s log level', function () {
      const cmd = ffmpeg({
        logLevel: LogLevel.Debug,
      });
      expect(cmd.getArgs().pop()).to.equal(LogLevel.Debug.toString());
    });
    it('should set overwrite to true', function () {
      const cmd = ffmpeg({
        overwrite: true,
      });
      expect(cmd.getArgs().shift()).to.equal('-y');
    });
    it('should set overwrite to false', function () {
      const cmd = ffmpeg({
        overwrite: false,
      });
      expect(cmd.getArgs().shift()).to.equal('-n');
    });
    it('should set progress to true', function () {
      const cmd = ffmpeg({
        progress: true,
      });
      expect(cmd.getArgs()[1]).to.equal('-progress');
    });
    it('should set progress to false', function () {
      const cmd = ffmpeg({
        progress: false,
      });
      expect(cmd.getArgs()[1]).to.not.equal('-progress');
    });
  });
  describe('FFmpegCommand', function () {
    this.timeout(10000);
    describe('input()', function () {
      it('should add a string as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input('protocol:location');
        expect(input.isStream).to.equal(false);
        expect(input.getArgs().pop()).to.equal('protocol:location');
      });
      it('should add a buffer as source', async function () {
        const cmd = ffmpeg();
        const invalidBuffer = await promises.readFile('test/samples/invalid');
        const input1 = cmd.input(invalidBuffer);
        const input2 = cmd.input(invalidBuffer.buffer);
        expect(input1.isStream).to.equal(true);
        expect(input2.isStream).to.equal(true);
      });
      it('should add an iterable as source', async function () {
        const cmd = ffmpeg();
        const input = cmd.input([await promises.readFile('test/samples/invalid')]);
        expect(input.isStream).to.equal(true);
      });
      it('should add an async iterable as source', function () {
        async function* asyncIterable() { yield await promises.readFile('test/samples/invalid'); }
        const cmd = ffmpeg();
        const input = cmd.input(asyncIterable());
        expect(input.isStream).to.equal(true);
      });
      it('should add a NodeJS.ReadableStream as source', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(Readable.from([await promises.readFile('test/samples/invalid')]));
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
    describe('probe()', function () {
      it('should probe simple inputs', async function () {
        const cmd = ffmpeg();
        const input = cmd.input('test/samples/video.mkv');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const result = await input.probe({ probeSize: 1024 * 1024 });
        expect(result.unwrap()).to.be.an('object');
        const result1 = await input.probe();
        expect(result1.unwrap()).to.be.an('object');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should probe buffer inputs', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(await promises.readFile('test/samples/video.mkv'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const result = await input.probe({ probeSize: 1024 * 1024 });
        expect(result.unwrap()).to.be.an('object');
        const result1 = await input.probe();
        expect(result1.unwrap()).to.be.an('object');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should probe streaming inputs', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(createReadStream('test/samples/video.mkv'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const result = await input.probe({ probeSize: 1024 * 1024 });
        expect(result.unwrap()).to.be.an('object');
        const result1 = await input.probe();
        expect(result1.unwrap()).to.be.an('object');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should throw on an invalid input path', async function () {
        const cmd = ffmpeg();
        const input = cmd.input('test/samples/invalid');
        let caught = false;
        try {
          await input.probe();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
      });
      it('should throw on an invalid input stream', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(createReadStream('test/samples/invalid'));
        let caught = false;
        try {
          await input.probe();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
      });
      it('should throw on an invalid input buffer', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(await promises.readFile('test/samples/invalid'));
        let caught = false;
        try {
          await input.probe();
        } catch {
          caught = true;
        }
        expect(caught).to.equal(true);
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
      it('should handle a NodeJS\' file write stream', async function () {
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output(createWriteStream('test/samples/[strange]output.mkv'))
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
      it('should handle NodeJS\' file write streams', async function () {
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output(createWriteStream('test/samples/output.mkv'), createWriteStream('test/samples/[strange]output.mkv'))
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
      it('should handle a simple output destination', async function () {
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output('test/samples/[strange]output.mkv')
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
      it('should handle streaming input sources', async function () {
        const cmd = ffmpeg();
        cmd.input(createReadStream('test/samples/video.webm'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
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
        else it('should send signal SIGSTOP', async function () {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output()
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          expect(process.pause()).to.equal(true);
          expect(process.unwrap().killed).to.equal(true);
          process.resume();
          process.kill('SIGKILL');
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
        else it('should send signal SIGCONT', async function () {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output()
            .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          process.pause();
          expect(process.resume()).to.equal(true);
          expect(process.unwrap().killed).to.equal(true);
          process.kill('SIGKILL');
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
        });
        it('should reject on errored process', async function () {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output()
            .args('-c', 'copy', '-f', 'my_invalid_muxer');
          const process = await cmd.spawn('./my_invalid_ffmpeg');
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
          expect(process.unwrap().exitCode).to.be.a('number');
        });
      });
    });
  });
});
