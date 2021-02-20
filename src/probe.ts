import { spawn as spawnChildProcess } from 'child_process';
import { InputSource, ProbeOptions, ProbeResult, RawProbeResult } from './types';
import { IGNORED_ERRORS, read, toReadableStream } from './utils';
import { Demuxer, Format } from './_types';
import { pipeline } from 'stream';
import { types } from 'util';

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
    args: argsOption = [],
    spawnOptions = {},
  } = options;
  if (probeSize !== void 0 && (!Number.isInteger(probeSize) || probeSize < 32))
    throw new TypeError(`Cannot probe ${probeSize} bytes, probeSize must be an integer >= 32`);
  if (analyzeDuration !== void 0 && !Number.isFinite(analyzeDuration))
    throw new TypeError(`Cannot probe an indefinite duration (${analyzeDuration})`);
  const args = [
    ...(probeSize !== void 0 ? ['-probesize', '' +  probeSize] : []),
    ...(analyzeDuration !== void 0 ? ['-analyzeduration', '' + (analyzeDuration * 1000)] : []),
    '-of', 'json=c=1',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    '-show_error',
    ...argsOption,
    ...(format !== void 0 ? ['-f', '' + format] : []),
    '-i',
    typeof source === 'string' ? source : 'pipe:0'
  ];
  const ffprobe = spawnChildProcess(ffprobePath, args, {
    stdio: 'pipe',
    ...spawnOptions,
  });

  let err: Error | undefined;
  let exited = false;

  const onExit = (error?: NodeJS.ErrnoException) => {
    exited = true;
    if (!err && error && !IGNORED_ERRORS.has(error.code!))
      err = error;
  };
  ffprobe.on('exit', onExit);
  ffprobe.on('error', onExit);

  try {
    let err: Error | undefined;
    if (types.isUint8Array(source)) {
      ffprobe.stdin.on('error', (error: NodeJS.ErrnoException) => {
        if (!err && !IGNORED_ERRORS.has(error.code!))
          err = error;
      });
      ffprobe.stdin.end(source);
    } else if (typeof source !== 'string') {
      pipeline(toReadableStream(source), ffprobe.stdin, (error) => {
        if (!err && error) err = error;
      });
    }
    const stdout = await read(ffprobe.stdout);
    const raw: RawProbeResult = JSON.parse(stdout.toString('utf8'));
    // When ffprobe defines an error property something went wrong.
    if (raw.error)
      throw Object.assign(new Error(raw.error.string), { ffprobePath, args });
    return new Result(raw);
  } finally {
    if (!exited) ffprobe.kill();
    // Forward the error Node.js stdio streams or the child process itself.
    if (err) {
      Error.captureStackTrace?.(err);
      throw err;
    }
  }
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
