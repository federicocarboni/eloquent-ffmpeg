import { createReadStream, createWriteStream, promises, unlinkSync } from 'fs';
import { PassThrough, Readable } from 'stream';
import { expect } from 'chai';

import { ffmpeg } from '../src/command';

describe('command', function () {
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
        expect(input1.isStream).to.equal(true);
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
    describe('concat()', function () {
      it('should add strings as files', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['test/samples/video.mkv', 'test/samples/video.mkv']);
        expect(input.isStream).to.equal(true);
      });
      it('should add streams as files', function () {
        const cmd = ffmpeg();
        const input = cmd.concat([new PassThrough(), new PassThrough()]);
        expect(input.isStream).to.equal(true);
      });
      it('should add multiple mixed sources as files', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['test/samples/video.mkv', new PassThrough()]);
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
      it('should add an async generator as destination', function () {
        const cmd = ffmpeg();
        const input = cmd.output(new PassThrough());
        expect(input.isStream).to.equal(true);
      });
      it('should add multiple mixed destinations', function () {
        const cmd = ffmpeg();
        const input = cmd.output('protocol:location', new PassThrough());
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
            cmd.output(createWriteStream('test/samples/output1.mkv'))
              .args('-c', 'copy', '-f', 'matroska');
          const process = await cmd.spawn();
          await process.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).to.equal(true);
          expect((await promises.lstat('test/samples/output.mkv')).isFile()).to.equal(true);
          expect((await promises.lstat('test/samples/output1.mkv')).isFile()).to.equal(true);
        } finally {
          try {
            unlinkSync('test/samples/[strange]output.mkv');
            unlinkSync('test/samples/output.mkv');
            unlinkSync('test/samples/output1.mkv');
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
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(new PassThrough())
          .args('-c', 'copy', '-f', 'matroska');
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle multiple streaming output destinations', async function () {
        const streams = [new PassThrough(), new PassThrough(), new PassThrough()];
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(...streams)
          .args('-c', 'copy', '-f', 'matroska');
        streams.forEach((stream) => {
          stream.on('data', (chunk) => {
            expect(chunk).to.be.an.instanceOf(Uint8Array);
          });
        });
        const process = await cmd.spawn();
        await process.complete();
      });
      it('should handle multiple streaming outputs', async function () {
        const streams = [new PassThrough(), new PassThrough(), new PassThrough()];
        const [stream1, stream2, stream3] = streams;
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(stream1)
          .args('-c', 'copy', '-f', 'matroska');
        cmd.output(stream2)
          .args('-c', 'copy', '-f', 'matroska');
        cmd.output(stream3)
          .args('-c', 'copy', '-f', 'matroska');
        streams.forEach((stream) => {
          stream.on('data', (chunk) => {
            expect(chunk).to.be.an.instanceOf(Uint8Array);
          });
        });
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
      it('should handle concat inputs', async function () {
        try {
          const cmd = ffmpeg();
          cmd.concat([
            'file:test/samples/video.mkv',
            {
              file: createReadStream('test/samples/video.mkv'),
              duration: 60000
            }
          ]);
          cmd.output(createWriteStream('test/samples/[strange]output.mkv'))
            .duration(60000 * 4)
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
      it('should handle concat inputs with extra options', async function () {
        try {
          const cmd = ffmpeg();
          cmd.concat([
            'file:test/samples/video.mkv',
            {
              file: createReadStream('test/samples/video.mkv'),
              duration: 60000
            }
          ], {
            protocols: ['file', 'unix'],
          });
          cmd.output(createWriteStream('test/samples/[strange]output.mkv'))
            .duration(60000 * 4)
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
    });
    describe('getArgs()', function () {
      it('should throw when no inputs are specified', async function () {
        const cmd = ffmpeg();
        cmd.output();
        expect(() => cmd.getArgs()).to.throw();
      });
      it('should throw when no outputs are specified', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        expect(() => cmd.getArgs()).to.throw();
      });
    });
  });
  describe('FFmpegInput', function () {
    it('format()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.format('mp4')).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-f') + 1]).to.equal('mp4');
    });
    it('codec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.codec('h264')).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c') + 1]).to.equal('h264');
    });
    it('videoCodec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.videoCodec('h264')).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c:V') + 1]).to.equal('h264');
    });
    it('audioCodec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.audioCodec('aac')).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c:a') + 1]).to.equal('aac');
    });
    it('subtitleCodec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.subtitleCodec('mov_text')).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c:s') + 1]).to.equal('mov_text');
    });
    it('duration()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.duration(2000)).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-t') + 1]).to.equal('2000ms');
    });
    it('start()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.start(2000)).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-ss') + 1]).to.equal('2000ms');
    });
    it('offset()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.offset(2000)).to.equal(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-itsoffset') + 1]).to.equal('2000ms');
    });
  });
  describe('FFmpegOutput', function () {
    it('format()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.format('mp4')).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-f') + 1]).to.equal('mp4');
    });
    it('codec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.codec('h264')).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c') + 1]).to.equal('h264');
    });
    it('videoCodec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.videoCodec('h264')).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c:V') + 1]).to.equal('h264');
    });
    it('audioCodec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.audioCodec('aac')).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c:a') + 1]).to.equal('aac');
    });
    it('subtitleCodec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.subtitleCodec('mov_text')).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c:s') + 1]).to.equal('mov_text');
    });
    it('videoFilter()', function () {
      const cmd = ffmpeg();
      const output = cmd.output('test/samples/video.mp4');
      expect(output.videoFilter('my_filter1', { opt1: true })).to.equal(output);
      expect(output.videoFilter('my_filter2', [42, 56])).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-filter:V') + 1]).to.equal('my_filter1=opt1=true,my_filter2=42:56');
    });
    it('audioFilter()', function () {
      const cmd = ffmpeg();
      const output = cmd.output('test/samples/video.mp4');
      expect(output.audioFilter('my_filter1', { opt1: true })).to.equal(output);
      expect(output.audioFilter('my_filter2', [42, 56])).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-filter:a') + 1]).to.equal('my_filter1=opt1=true,my_filter2=42:56');
    });
    it('duration()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.duration(2000)).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-t') + 1]).to.equal('2000ms');
    });
    it('start()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.start(2000)).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-ss') + 1]).to.equal('2000ms');
    });
    it('map()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.map('0:1', '1:0')).to.equal(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-map') + 1]).to.equal('0:1');
      expect(args[args.lastIndexOf('-map') + 1]).to.equal('1:0');
    });
    it('metadata()', async function () {
      const cmd = ffmpeg();
      let output = cmd.output();
      expect(output.metadata({ title: 'something', artist: 'someone' }, 's:0')).to.equal(output);
      let args = output.getArgs();
      expect(args[args.indexOf('-metadata:s:0') + 1]).to.equal('title=something');
      expect(args[args.lastIndexOf('-metadata:s:0') + 1]).to.equal('artist=someone');
      expect(output.metadata({ title: 'something', artist: 'someone' }, 's:0')).to.equal(output);
      output = cmd.output();
      expect(output.metadata({ title: 'something', artist: 'someone' })).to.equal(output);
      args = output.getArgs();
      expect(args[args.indexOf('-metadata') + 1]).to.equal('title=something');
      expect(args[args.lastIndexOf('-metadata') + 1]).to.equal('artist=someone');
    });
  });
});
