import { parseTimestamp } from './string';

// For now these interfaces are internal, they should have a similar shape
// as probe() function/method.
interface LoggedFormat {
  file: string;
  name: string;
  start: number;
  duration?: number;
  bitrate?: number;
  metadata: Record<string, string>;
}

interface LoggedStream {
  metadata: Record<string, string>;
}

interface LoggedChapter {
  start: number;
  end: number;
  metadata: Record<string, string>;
}

interface LoggedInput {
  format: LoggedFormat;
  streams: LoggedStream[];
  chapters: LoggedChapter[];
}

export interface Logs {
  inputs: LoggedInput[];
}

const enum State {
  Format,
  FormatMetadata,
  Chapter,
  ChapterMetadata,
  Stream,
  StreamMetadata,
  Default,
}

const INPUT_MATCH = /^(\[info\] )?Input #([0-9]+), (.+?), from '(.*?)':$/;
const INDENT_2_METADATA_MATCH = /^(\[info\] )? {4}(.*?) *: (.*)$/;
const INDENT_3_METADATA_MATCH = /^(\[info\] )? {6}(.*?) *: (.*)$/;
const DURATION_START_BITRATE_MATCH = /^(\[info\] )? {2}Duration: ([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2}|N\/A), start: (-?[0-9]*\.[0-9]{3})[0-9]{3}, bitrate: (([0-9.]+) kb\/s|N\/A)$/;
const CHAPTER_MATCH = /^(\[info\] )? {4}Chapter #[0-9]+:[0-9]+: start (-?[0-9]*\.[0-9]{3})[0-9]{3}, end (-?[0-9]*\.[0-9]{3})[0-9]{3}/;
const STREAM_TEST = /^(\[info\] )? {4}Stream #[0-9]+:[0-9]+.*$/;
const INDENT_2_METADATA_TEST = /^(\[info\] )? {2}Metadata:/;
const INDENT_3_METADATA_TEST = /^(\[info\] )? {4}Metadata:/;

export async function parseLogs(stderr: AsyncIterable<string>): Promise<Logs> {
  const inputs: LoggedInput[] = [];
  const logs: Logs = { inputs };

  let metadata: Record<string, string>;
  let lastKey: string | undefined;

  let format: LoggedFormat;
  let streams: LoggedStream[];
  let chapters: LoggedChapter[];

  const readMetadata = (match: RegExpMatchArray | null) => {
    if (match === null)
      return;
    const [, , key, value] = match;
    if (key === '' && lastKey !== void 0) {
      metadata[lastKey] += `\n${value}`;
    } else {
      metadata[key] = value;
      lastKey = key;
    }
  };

  let state = State.Default;

  // Loop until null is passed to next()
  for await (const line of stderr) {
    // A new input may start after streams or chapters sections.
    switch (state) {
      case State.Format: {
        if (INDENT_2_METADATA_TEST.test(line)) {
          state = State.FormatMetadata;
          break;
        }
      }
      // Falls through
      case State.FormatMetadata: {
        const match = line.match(DURATION_START_BITRATE_MATCH);
        if (match !== null) {
          const [, , duration, start, br, bitrate] = match;
          if (duration !== 'N/A')
            format!.duration = parseTimestamp(duration);
          if (br !== 'N/A')
            format!.bitrate = +bitrate;
          format!.start = +start * 1000;
          state = State.Chapter;
        } else if (state === State.FormatMetadata) {
          readMetadata(line.match(INDENT_2_METADATA_MATCH));
        }
        break;
      }
      // If it's not a chapter fall through
      case State.Chapter:
        if (INDENT_3_METADATA_TEST.test(line)) {
          state = State.ChapterMetadata;
          break;
        }
      // Falls through
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
          readMetadata(line.match(INDENT_3_METADATA_MATCH));
        }
        break;
      }
    }
  }

  return logs;
}
