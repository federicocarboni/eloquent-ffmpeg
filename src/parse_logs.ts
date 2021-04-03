/**
 * This module adds **EXPERIMENTAL** support for parsing FFmpeg's logs into a JavaScript object.
 */

import { LoggedChapter, LoggedFormat, LoggedInput, LoggedStream, Logs } from './types';

const INPUT_MATCH = /^(\[info\] )?Input #([0-9]+), (.+?), from '(.*?)':$/;
const INDENT_2_METADATA_MATCH = /^(\[info\] )? {4}(.*?) *: (.*)$/;
const INDENT_3_METADATA_MATCH = /^(\[info\] )? {6}(.*?) *: (.*)$/;
const DURATION_START_BITRATE_MATCH = /^(\[info\] )? {2}Duration: (([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2})|N\/A), start: (-?[0-9]*\.[0-9]{3})[0-9]{3}, bitrate: (([0-9]+) kb\/s|N\/A)$/;
const CHAPTER_MATCH = /^(\[info\] )? {4}Chapter #[0-9]+:[0-9]+: start (-?[0-9]*\.[0-9]{3})[0-9]{3}, end (-?[0-9]*\.[0-9]{3})[0-9]{3}$/;
const STREAM_TEST = /^(\[info\] )? {4}Stream #[0-9]+:[0-9]+/;
const INDENT_2_METADATA_TEST = /^(\[info\] )? {2}Metadata:$/;
const INDENT_3_METADATA_TEST = /^(\[info\] )? {4}Metadata:$/;
const END_TEST = /^(\[info\] )?(Stream mapping:|Press \[q\] to stop, \[?\] for help|Output #)/;

const enum State {
  Format,
  FormatMetadata,
  ChapterOrStream,
  Chapter,
  ChapterMetadata,
  Stream,
  StreamMetadata,
  Default,
}

export async function parseLogs(stderr: AsyncIterable<string>): Promise<Logs> {
  const parseMetadata = (match: RegExpMatchArray | null) => {
    if (match === null)
      return;
    const [, , key, value] = match;
    if (key === '') {
      metadata[lastKey] += `\n${value}`;
    } else {
      metadata[key] = value;
      lastKey = key;
    }
  };

  const inputs: LoggedInput[] = [];
  const logs: Logs = { inputs };

  let metadata: Record<string, string>;
  let lastKey = '';

  let format: LoggedFormat;
  let streams: LoggedStream[];
  let chapters: LoggedChapter[];

  // Store the current state of the parser.
  let state = State.Default;

  for await (const line of stderr) {
    // TODO: find a better way to detect the end of inputs info.
    if (END_TEST.test(line))
      break;
    switch (state) {
      case State.Format:
        if (INDENT_2_METADATA_TEST.test(line)) {
          state = State.FormatMetadata;
          break;
        }
      // Falls through
      case State.FormatMetadata: {
        const match = line.match(DURATION_START_BITRATE_MATCH);
        if (match !== null) {
          const [, , duration, h, min, s, cs, start, bitrate, kb] = match;
          if (duration !== 'N/A')  // Turn the duration into ms
            format!.duration = (+h) * 3600000 + (+min) * 60000 + (+s) * 1000 + (+cs) * 10;
          if (bitrate !== 'N/A')  // Convert from kb/s to bits/s
            format!.bitrate = (+kb) * 1000;
          format!.start = +start * 1000;
          state = State.ChapterOrStream;
        } else if (state === State.FormatMetadata) {
          parseMetadata(line.match(INDENT_2_METADATA_MATCH));
        }
        break;
      }
      case State.Chapter:
        if (INDENT_3_METADATA_TEST.test(line)) {
          state = State.ChapterMetadata;
          break;
        }
      // Falls through
      case State.ChapterOrStream:
      case State.ChapterMetadata: {
        const match = line.match(CHAPTER_MATCH);
        if (match !== null) {
          const [, , start, end] = match;
          metadata = Object.create(null);
          chapters!.push({ start: +start * 1000, end: +end * 1000, metadata });
          state = State.Chapter;
          break;
        }
      }
      // Falls through
      case State.Stream:
        if (state === State.Stream && INDENT_3_METADATA_TEST.test(line)) {
          state = State.StreamMetadata;
          break;
        }
      // Falls through
      case State.StreamMetadata:
        if (STREAM_TEST.test(line)) {
          metadata = Object.create(null);
          streams!.push({ metadata });
          state = State.Stream;
          break;
        }
      // Falls through
      case State.Default: {
        // A new input may start after chapters or streams sections
        const match = line.match(INPUT_MATCH);
        if (match !== null) {
          const [, , , name, file] = match;
          metadata = Object.create(null);
          format = {
            file,
            name,
            start: 0,
            duration: void 0,
            bitrate: void 0,
            metadata,
          };
          streams = [];
          chapters = [];
          inputs.push({ format, streams, chapters });
          state = State.Format;
        } else if (state === State.ChapterMetadata || state === State.StreamMetadata) {
          parseMetadata(line.match(INDENT_3_METADATA_MATCH));
        }
        break;
      }
    }
  }

  return logs;
}
