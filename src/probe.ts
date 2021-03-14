import type { InputSource, ProbeOptions, ProbeResult, RawProbeResult } from './types';
import type { Demuxer, Format } from './_types';

import * as childProcess from 'child_process';
import * as stream from 'stream';
import { promisify } from 'util';

import { exited, read, toReadableStream } from './utils';

const IGNORED_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'EOF']);
const pipeline = promisify(stream.pipeline);

/**
 * Probes the given `source` using ffprobe.
 * @param source - The source to probe. Accepts the same types as `FFmpegCommand.input()`.
 * @param options -
 * @example
 * ```ts
 * const result = await probe('input.mp4');
 * console.log(result.format);
 * ```
 * @alpha
 */
export async function probe(source: InputSource, options: ProbeOptions = {}): Promise<ProbeResult> {
  const {
    probeSize,
    analyzeDuration,
    ffprobePath = 'ffprobe',
    format,
    args: extraArgs = [],
    spawnOptions
  } = options;

  if (probeSize !== void 0 && (!Number.isInteger(probeSize) || probeSize < 32))
    throw new TypeError(`Cannot probe ${probeSize} bytes, probeSize must be an integer >= 32`);
  if (analyzeDuration !== void 0 && !Number.isFinite(analyzeDuration))
    throw new TypeError(`Cannot probe an indefinite duration (${analyzeDuration})`);

  const args = [
    ...(probeSize !== void 0 ? ['-probesize', '' + probeSize] : []),
    ...(analyzeDuration !== void 0 ? ['-analyzeduration', '' + (analyzeDuration * 1000)] : []),
    '-of', 'json=c=1',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    '-show_error',
    ...extraArgs,
    ...(format !== void 0 ? ['-f', '' + format] : []),
    '-i',
    typeof source === 'string' ? source : 'pipe:0'
  ];
  const ffprobe = childProcess.spawn(ffprobePath, args, {
    stdio: 'pipe',
    ...spawnOptions,
  });

  // Await output from stdout, for the process to exit and for source to have
  // been piped to stdin if not a string.
  const [stdout] = await Promise.all([
    read(ffprobe.stdout),
    exited(ffprobe),
    typeof source !== 'string' && pipeline(toReadableStream(source), ffprobe.stdin).catch((err) => {
      if (!IGNORED_ERRORS.has(err.code))
        throw err;
    }) as any,  // ¯\_(ツ)_/¯ TypeScript doesn't like `Promise<void> | false` in `Promise.all`
  ]);

  const raw: RawProbeResult = JSON.parse(stdout.toString('utf8'));
  if (raw.error)
    throw Object.assign(new Error(raw.error.string), { ffprobePath, args });

  return new Result(raw);
}

class Result implements ProbeResult {
  #raw: RawProbeResult;

  constructor(raw: RawProbeResult) {
    this.#raw = raw;
    if (raw.format.format_name)
      this.format = raw.format.format_name;
    if (raw.format.format_long_name)
      this.formatName = raw.format.format_long_name;
    this.start = +raw.format.start_time * 1000 | 0;
    this.duration = +raw.format.duration * 1000 | 0;
    this.score = raw.format.probe_score >>> 0;
    if (raw.format.tags)
      this.tags = tags(raw.format.tags);
  }

  format?: Demuxer | Format | (string & {});
  formatName?: string;
  start: number;
  duration: number;
  bitrate?: number;
  score: number;
  tags?: Map<string, string>;

  unwrap(): RawProbeResult {
    return this.#raw;
  }
}

function tags(o: any): Map<string, string> {
  return new Map(Object.entries(o).map(([key, value]) => [key.toLowerCase(), '' + value]));
}
