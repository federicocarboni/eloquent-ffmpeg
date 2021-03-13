import { createReadStream, createWriteStream, promises, unlinkSync } from 'fs';
import { PassThrough, Readable } from 'stream';
import { join } from 'path';

import { ffmpeg } from '../src/command';
import { LogLevel } from '../src/types';
import { probe } from '../src/probe';

describe('command', function () {
  describe('ffmpeg()', function () {
    it('should set overwrite to true by default', function () {
      const cmd = ffmpeg();
      cmd.input('test/samples/invalid');
      cmd.output();
      expect(cmd.getArgs()).toContain('-y');
    });
    it('should set overwrite to false', function () {
      const cmd = ffmpeg({ overwrite: false });
      cmd.input('test/samples/invalid');
      cmd.output();
      expect(cmd.getArgs()).toContain('-n');
    });
    it('should set progress to true by default', function () {
      const cmd = ffmpeg({ progress: true });
      cmd.input('test/samples/invalid');
      cmd.output();
      expect(cmd.getArgs()).toContain('-progress');
    });
    it('should set progress to false', function () {
      const cmd = ffmpeg({ progress: false });
      cmd.input('test/samples/invalid');
      cmd.output();
      expect(cmd.getArgs()).not.toContain('-progress');
    });
  });
  describe('FFmpegCommand', function () {
    describe('input()', function () {
      it('should add a string as source', function () {
        const cmd = ffmpeg();
        const input = cmd.input('protocol:location');
        expect(input.isStream).toBe(false);
        expect(input.getArgs().pop()).toBe('protocol:location');
      });
      it('should add a buffer as source', async function () {
        const cmd = ffmpeg();
        const invalidBuffer = await promises.readFile('test/samples/invalid');
        const input1 = cmd.input(invalidBuffer);
        expect(input1.isStream).toBe(true);
      });
      it('should add an async iterable as source', function () {
        async function* asyncIterable() { yield await promises.readFile('test/samples/invalid'); }
        const cmd = ffmpeg();
        const input = cmd.input(asyncIterable());
        expect(input.isStream).toBe(true);
      });
      it('should add a NodeJS.ReadableStream as source', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(Readable.from([await promises.readFile('test/samples/invalid')]));
        expect(input.isStream).toBe(true);
      });
    });
    describe('concat()', function () {
      it('should add strings as files', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv', 'file:test/samples/video.mkv']);
        expect(input.isStream).toBe(true);
      });
      it('should add streams as files', function () {
        const cmd = ffmpeg();
        const input = cmd.concat([new PassThrough(), new PassThrough()]);
        expect(input.isStream).toBe(true);
      });
      it('should add multiple mixed sources as files', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv', new PassThrough()]);
        expect(input.isStream).toBe(true);
      });
      it('should use a data uri when useDataURI is true', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv', 'file:test/samples/video.mkv'], {
          useDataURI: true,
        });
        expect(input.isStream).toBe(false);
      });
      it('should set safe to 0 by default', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv']);
        expect(input.isStream).toBe(true);
        const args = input.getArgs();
        expect(args[args.indexOf('-safe') + 1]).toBe('0');
      });
      it('should set safe to 1', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv'], { safe: true });
        expect(input.isStream).toBe(true);
        const args = input.getArgs();
        expect(args[args.indexOf('-safe') + 1]).toBe('1');
      });
      it('should set protocol whitelist', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv'], {
          protocols: ['unix', 'file'],
        });
        expect(input.isStream).toBe(true);
        const args = input.getArgs();
        expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('unix,file');
      });
      it('should not set protocol whitelist if empty', function () {
        const cmd = ffmpeg();
        const input = cmd.concat(['file:test/samples/video.mkv'], {
          protocols: [],
        });
        expect(input.isStream).toBe(true);
        const args = input.getArgs();
        expect(args.includes('-protocol_whitelist')).toBe(false);
      });
    });
    describe('output()', function () {
      it('should add a string as destination', function () {
        const cmd = ffmpeg();
        const input = cmd.output('protocol:location');
        expect(input.isStream).toBe(false);
        expect(input.getArgs().pop()).toBe('protocol:location');
      });
      it('should set /dev/null or NUL as destination', function () {
        const cmd = ffmpeg();
        const input = cmd.output();
        const lastArg = input.getArgs().pop();
        expect(input.isStream).toBe(false);
        expect(typeof lastArg).toBe('string');
        expect(lastArg).toBe(process.platform === 'win32' ? 'NUL' : '/dev/null');
      });
      it('should add a readable stream as destination', function () {
        const cmd = ffmpeg();
        const input = cmd.output(new PassThrough());
        expect(input.isStream).toBe(true);
      });
      it('should add multiple mixed destinations', function () {
        const cmd = ffmpeg();
        const input = cmd.output('protocol:location', new PassThrough());
        const lastArg = input.getArgs().pop();
        expect(input.isStream).toBe(true);
        expect(typeof lastArg).toBe('string');
        expect(lastArg!.startsWith('tee:')).toBe(true);
      });
    });
    describe('probe()', function () {
      it('should probe simple inputs', async function () {
        const cmd = ffmpeg();
        const input = cmd.input('test/samples/video.mkv');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const result = await input.probe({ probeSize: 1024 * 1024 });
        expect(typeof result.unwrap()).toBe('object');
        const result1 = await input.probe();
        expect(typeof result1.unwrap()).toBe('object');
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should probe buffer inputs', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(await promises.readFile('test/samples/video.mkv'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const result = await input.probe({ probeSize: 1024 * 1024 });
        expect(typeof result.unwrap()).toBe('object');
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should probe streaming inputs', async function () {
        const cmd = ffmpeg();
        const input = cmd.input(createReadStream('test/samples/video.mkv'));
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const result = await input.probe({ probeSize: 1024 * 1024 });
        expect(typeof result.unwrap()).toBe('object');
        const proc = await cmd.spawn();
        await proc.complete();
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
        expect(caught).toBe(true);
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
        expect(caught).toBe(true);
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
        expect(caught).toBe(true);
      });
    });
    describe('args()', function () {
      it('should return this', function () {
        const cmd = ffmpeg();
        expect(cmd.args()).toBe(cmd);
      });
      it('should push arguments to the start of the command', async function () {
        const cmd = ffmpeg();
        expect(cmd.args()).toBe(cmd);
      });
    });
    describe('spawn()', function () {
      it('should handle report set to true', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output().format('matroska');
        const proc = await cmd.spawn({
          report: true,
          spawnOptions: {
            // Create the report file in test/samples
            cwd: 'test/samples'
          },
        });
        await proc.complete().catch(() => {
          //
        });
        const files = await promises.readdir('test/samples');
        const log = files.find((file) => file.startsWith('ffmpeg-'))!;
        expect(log).not.toBeUndefined();
        await promises.readFile(join('test/samples', log), 'utf8');
        await promises.unlink(join('test/samples', log));
      });
      it('should handle report file and level', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        cmd.output().format('matroska');
        const proc = await cmd.spawn({
          report: {
            file: 'test/samples/report.log',
            level: LogLevel.Info,
          },
        });
        await proc.complete().catch(() => {
          //
        });
        await promises.readFile('test/samples/report.log', 'utf8');
        await promises.unlink('test/samples/report.log');
      });
      it('should cleanup socket servers on errored proc', async function () {
        const cmd = ffmpeg();
        cmd.input(createReadStream('test/samples/video.mkv'));
        const writeStream = createWriteStream('test/samples/output.mkv');
        cmd.output(writeStream);
        const proc = await cmd.spawn({
          ffmpegPath: './my_invalid_ffmpeg'
        });
        let caught = false;
        try {
          await proc.complete();
        } catch {
          caught = true;
        }
        expect(proc.unwrap().exitCode).not.toBeNull();
        expect(caught).toBe(true);
        caught = false;
        try {
          await proc.complete();
        } catch {
          caught = true;
        }
        expect(caught).toBe(true);
        writeStream.end();
        try {
          unlinkSync('test/samples/output.mkv');
        } catch {
          //
        }
      });
      it('should handle a NodeJS\' file write stream', async function () {
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output(createWriteStream('test/samples/[strange]output.mkv'))
            .args('-c', 'copy', '-f', 'matroska');
          const proc = await cmd.spawn();
          await proc.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).toBe(true);
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
          unlinkSync('test/samples/[strange]output.mkv');
          unlinkSync('test/samples/output.mkv');
          unlinkSync('test/samples/output1.mkv');
        } catch {
          //
        }
        try {
          const cmd = ffmpeg();
          cmd.input('test/samples/video.mp4');
          cmd.output(createWriteStream('test/samples/output.mkv'), createWriteStream('test/samples/[strange]output.mkv'))
            .args('-c', 'copy', '-f', 'matroska');
            cmd.output(createWriteStream('test/samples/output1.mkv'))
              .args('-c', 'copy', '-f', 'matroska');
          const proc = await cmd.spawn();
          await proc.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).toBe(true);
          expect((await promises.lstat('test/samples/output.mkv')).isFile()).toBe(true);
          expect((await promises.lstat('test/samples/output1.mkv')).isFile()).toBe(true);
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
          const proc = await cmd.spawn();
          await proc.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).toBe(true);
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
          const proc = await cmd.spawn();
          await proc.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).toBe(true);
          expect((await promises.lstat('test/samples/output.mkv')).isFile()).toBe(true);
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
        expect.hasAssertions();
        const stream = new PassThrough();
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(stream)
          .args('-c', 'copy', '-f', 'matroska');
        stream.on('data', (chunk) => {
          expect(chunk).toBeInstanceOf(Uint8Array);
        });
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should handle multiple streaming output destinations', async function () {
        expect.hasAssertions();
        const streams = [new PassThrough(), new PassThrough(), new PassThrough()];
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output(...streams)
          .args('-c', 'copy', '-f', 'matroska');
        streams.forEach((stream) => {
          stream.on('data', (chunk) => {
            expect(chunk).toBeInstanceOf(Uint8Array);
          });
        });
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should handle multiple streaming outputs', async function () {
        expect.hasAssertions();
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
            expect(chunk).toBeInstanceOf(Uint8Array);
          });
        });
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should handle null outputs', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should handle streaming input sources', async function () {
        const readable = createReadStream('test/samples/video.webm');
        setTimeout(() => {
          try{

            readable.emit('error', new Error('Synthetic error'));
          } catch {
            //
          }
        }, 120);
        const cmd = ffmpeg();
        cmd.input(readable);
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should handle simple inputs', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/video.mp4');
        cmd.output()
          .args('-c', 'copy', '-f', 'matroska');
        const proc = await cmd.spawn();
        await proc.complete();
      });
      it('should handle concat inputs', async function () {
        try {
          const cmd = ffmpeg();
          cmd.concat([
            'file:test/samples/video.mkv',
            createReadStream('test/samples/video.mkv'),
          ]);
          cmd.output(createWriteStream('test/samples/[strange]output.mkv'))
            .duration(120000)
            .args('-c', 'copy', '-f', 'matroska');
          const proc = await cmd.spawn();
          await proc.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).toBe(true);
          const info = await probe('test/samples/[strange]output.mkv');
          expect(info.duration).toBe(120000);
          expect(info.score).toBe(100);
          expect(info.format).toBe('matroska,webm');
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
          cmd.concat([{
            file: 'file:test/samples/video.mkv',
            inpoint: 30100,
          }, {
            file: 'file:test/samples/video.mkv',
            duration: 30000,
            outpoint: 30000,
          }], {
            protocols: ['file', 'unix', 'data'],
          });
          cmd.output('test/samples/[strange]output.mkv')
            .args('-c', 'copy', '-f', 'matroska');
          const proc = await cmd.spawn();
          await proc.complete();
          expect((await promises.lstat('test/samples/[strange]output.mkv')).isFile()).toBe(true);
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
        expect(() => cmd.getArgs()).toThrow();
      });
      it('should throw when no outputs are specified', async function () {
        const cmd = ffmpeg();
        cmd.input('test/samples/invalid');
        expect(() => cmd.getArgs()).toThrow();
      });
    });
  });
  describe('FFmpegInput', function () {
    it('format()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.format('mp4')).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-f') + 1]).toBe('mp4');
    });
    it('codec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.codec('h264')).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c') + 1]).toBe('h264');
    });
    it('videoCodec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.videoCodec('h264')).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c:V') + 1]).toBe('h264');
    });
    it('audioCodec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.audioCodec('aac')).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
    });
    it('subtitleCodec()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.subtitleCodec('mov_text')).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-c:s') + 1]).toBe('mov_text');
    });
    it('duration()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.duration(2000)).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-t') + 1]).toBe('2000ms');
    });
    it('start()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.start(2000)).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-ss') + 1]).toBe('2000ms');
    });
    it('offset()', function () {
      const cmd = ffmpeg();
      const input = cmd.input('test/samples/video.mp4');
      expect(input.offset(2000)).toBe(input);
      const args = input.getArgs();
      expect(args[args.indexOf('-itsoffset') + 1]).toBe('2000ms');
    });
  });
  describe('FFmpegOutput', function () {
    it('format()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.format('mp4')).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-f') + 1]).toBe('mp4');
    });
    it('codec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.codec('h264')).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c') + 1]).toBe('h264');
    });
    it('videoCodec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.videoCodec('h264')).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c:V') + 1]).toBe('h264');
    });
    it('audioCodec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.audioCodec('aac')).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
    });
    it('subtitleCodec()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.subtitleCodec('mov_text')).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-c:s') + 1]).toBe('mov_text');
    });
    it('videoFilter()', function () {
      const cmd = ffmpeg();
      const output = cmd.output('test/samples/video.mp4');
      expect(output.videoFilter('my_filter1', { opt1: true })).toBe(output);
      expect(output.videoFilter('my_filter2', [42, 56])).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-filter:V') + 1]).toBe('my_filter1=opt1=true,my_filter2=42:56');
    });
    it('audioFilter()', function () {
      const cmd = ffmpeg();
      const output = cmd.output('test/samples/video.mp4');
      expect(output.audioFilter('my_filter1', { opt1: true })).toBe(output);
      expect(output.audioFilter('my_filter2', [42, 56])).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-filter:a') + 1]).toBe('my_filter1=opt1=true,my_filter2=42:56');
    });
    it('duration()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.duration(2000)).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-t') + 1]).toBe('2000ms');
    });
    it('start()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.start(2000)).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-ss') + 1]).toBe('2000ms');
    });
    it('map()', function () {
      const cmd = ffmpeg();
      const output = cmd.output();
      expect(output.map('0:1', '1:0')).toBe(output);
      const args = output.getArgs();
      expect(args[args.indexOf('-map') + 1]).toBe('0:1');
      expect(args[args.lastIndexOf('-map') + 1]).toBe('1:0');
    });
    it('metadata()', async function () {
      const cmd = ffmpeg();
      cmd.input('test/samples/video.mkv');
      let output = cmd.output();
      expect(output.metadata({
        title: '\'somethin\\ =g',
        artist: 'someone'
      }, 's:0')).toBe(output);
      let args = output.getArgs();
      expect(args[args.indexOf('-metadata:s:0') + 1]).toBe('title=\'somethin\\ =g');
      expect(args[args.lastIndexOf('-metadata:s:0') + 1]).toBe('artist=someone');
      output = cmd.output();
      expect(output.metadata({ title: 'something', artist: 'someone' }, 's:0')).toBe(output);
      expect(output.metadata({ title: 'something', artist: 'someone' })).toBe(output);
      args = output.getArgs();
      expect(args[args.indexOf('-metadata:s:0') + 1]).toBe('title=something');
      expect(args[args.lastIndexOf('-metadata:s:0') + 1]).toBe('artist=someone');
      expect(args[args.indexOf('-metadata') + 1]).toBe('title=something');
      expect(args[args.lastIndexOf('-metadata') + 1]).toBe('artist=someone');
    });
  });
});
