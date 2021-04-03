import { Readable } from 'stream';
import { parseLogs } from '../src/parse_logs';

// const TEST_LINES = `\
// [info] Input #0, matroska,webm, from 'video0.mkv':
// [info]   Metadata:
// [info]     ENCODER         : Lavf58.58.100
// [info]     key             : multiline
// [info]                     : value
// [info]   Duration: 00:01:00.02, start: 0.000000, bitrate: 168 kb/s
// [info]     Chapter #0:0: start 0.000000, end 30.000000
// [info]     Metadata:
// [info]       hh              : 2
// [info]     Stream #0:0: Video: h264 (High), yuv420p(progressive), 1280x720 [SAR 1:1 DAR 16:9], 25 fps, 25 tbr, 1k tbn, 50 tbc (default)
// [info]     Stream #0:1: Audio: aac (LC), 44100 Hz, mono, fltp (default)
// [info]     Metadata:
// [info]       ENCODER          : Lavc58.106.100 aac
// [info]       DURATION         : 00:01:00.023000000
// [info] Input #1, matroska,webm, from 'video1.mkv':
// [info]   Duration: 00:01:00.02, start: -0.120000, bitrate: 168 kb/s
// [info]     Chapter #0:0: start 0.000000, end 30.000000
// [info]     Stream #0:0: Video: h264 (High), yuv420p(progressive), 1280x720 [SAR 1:1 DAR 16:9], 25 fps, 25 tbr, 1k tbn, 50 tbc (default)
// [info]     Stream #0:1: Audio: aac (LC), 44100 Hz, mono, fltp (default)
// `.split('\n');

describe('parse_logs', () => {
  describe('parseLogs()', () => {
    it('should parse format metadata', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Metadata:
[info]     key0            : value
[info]     key1            : multiline
[info]                     : value
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].format.file).toBe('video.mkv');
      expect(logs.inputs[0].format.name).toBe('matroska,webm');
      expect(logs.inputs[0].format.metadata.key0).toBe('value');
      expect(logs.inputs[0].format.metadata.key1).toBe('multiline\nvalue');
    });
    it('should parse format duration, start and bitrate', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Metadata:
[info]     key0            : value
[info]   Duration: 00:01:01.01, start: 1.010000, bitrate: 500 kb/s
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].format.duration).toBe(61010);
      expect(logs.inputs[0].format.start).toBe(1010);
      expect(logs.inputs[0].format.bitrate).toBe(500000);
    });
    it('should parse negative format start', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Duration: 00:00:00.00, start: -1.010000, bitrate: 0 kb/s
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].format.start).toBe(-1010);
    });
    it('should parse format duration and bitrate (N/A)', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Duration: N/A, start: 0.000000, bitrate: N/A
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].format.duration).toBeUndefined();
      expect(logs.inputs[0].format.bitrate).toBeUndefined();
    });
    it('should parse a chapter', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Duration: N/A, start: 0.000000, bitrate: N/A
[info]     Chapter #0:0: start 1.010000, end 30.030000
[info]     Metadata:
[info]       key0            : value
[info]       key1            : multiline
[info]                       : value
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].chapters.length).toBe(1);
      expect(logs.inputs[0].chapters[0].start).toBe(1010);
      expect(logs.inputs[0].chapters[0].end).toBe(30030);
      expect(logs.inputs[0].chapters[0].metadata.key0).toBe('value');
      expect(logs.inputs[0].chapters[0].metadata.key1).toBe('multiline\nvalue');
    });
    it('should parse a chapter', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Duration: N/A, start: 0.000000, bitrate: N/A
[info]     Chapter #0:0: start 1.010000, end 30.030000
[info]     Metadata:
[info]       key0            : value
[info]       key1            : multiline
[info]                       : value
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].chapters.length).toBe(1);
      expect(logs.inputs[0].chapters[0].start).toBe(1010);
      expect(logs.inputs[0].chapters[0].end).toBe(30030);
      expect(logs.inputs[0].chapters[0].metadata.key0).toBe('value');
      expect(logs.inputs[0].chapters[0].metadata.key1).toBe('multiline\nvalue');
    });
    it('should parse a stream', async () => {
      const logs = await parseLogs(Readable.from(`\
[info] Input #0, matroska,webm, from 'video.mkv':
[info]   Duration: N/A, start: 0.000000, bitrate: N/A
[info]     Stream #0:0: Video: h264 (High), yuv420p(progressive), 1280x720 [SAR 1:1 DAR 16:9], 25 fps, 25 tbr, 1k tbn, 50 tbc (default)
[info]     Metadata:
[info]       key0            : value
[info]       key1            : multiline
[info]                       : value
`.split('\n')));
      expect(logs.inputs.length).toBe(1);
      expect(logs.inputs[0].streams.length).toBe(1);
      expect(logs.inputs[0].streams[0].metadata.key0).toBe('value');
      expect(logs.inputs[0].streams[0].metadata.key1).toBe('multiline\nvalue');
    });
  });
});
