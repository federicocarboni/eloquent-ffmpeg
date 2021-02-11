import {
  escapeConcatFile,
  escapeFilterValue,
  escapeTeeComponent,
  stringifyFilterDescription,
  stringifyValue
} from '../src/string';

describe('string', function () {
  it('escapeFilterValue()', function () {
    const unescaped = "I'm a string;, with many[special]: characters";
    const escaped = "I\\'m a string;, with many[special]\\: characters";
    expect(escapeFilterValue(unescaped)).toBe(escaped);
  });
  it('escapeConcatFile()', function () {
    const unescaped = "I'm a string;, with many[special]: characters";
    const escaped = "I\\'m\\ a\\ string;,\\ with\\ many[special]:\\ characters";
    expect(escapeConcatFile(unescaped)).toBe(escaped);
  });
  it('escapeTeeComponent()', function () {
    const unescaped = "I'm a string;| with many[special]: characters";
    const escaped = "I\\'m\\ a\\ string;\\|\\ with\\ many\\[special\\]:\\ characters";
    expect(escapeTeeComponent(unescaped)).toBe(escaped);
  });
  describe('stringifyValue()', function () {
    it('should stringify Date to an ISO string', function () {
      const s = '1970-01-01T00:00:00.000Z';
      const date = new Date(s);
      expect(stringifyValue(date)).toBe(s);
    });
    it('should coerce non-matching objects to string', function () {
      expect(stringifyValue(true)).toBe('true');
      expect(stringifyValue(1)).toBe('1');
    });
  });
  describe('stringifyFilterDescription()', function () {
    it('should stringify options array', function () {
      expect(stringifyFilterDescription('my_filter', ['opt1', 'opt2'])).toBe('my_filter=opt1:opt2');
      expect(stringifyFilterDescription('my_filter', [`chars ' which \\ can : cause problems`]))
        .toBe(`my_filter=chars \\' which \\\\ can \\: cause problems`);
    });
    it('should stringify options object', function () {
      expect(stringifyFilterDescription('my_filter', { a: '1', b: '2' })).toBe('my_filter=a=1:b=2');
      expect(stringifyFilterDescription('my_filter', {
        a: `chars ' which \\ can : cause problems`,
      })).toBe(`my_filter=a=chars \\' which \\\\ can \\: cause problems`);
    });
    it('should stringify non-string values', function () {
      expect(stringifyFilterDescription('my_filter', [1, 2])).toBe('my_filter=1:2');
      expect(stringifyFilterDescription('my_filter', {
        a: 1,
        b: 2,
      })).toBe('my_filter=a=1:b=2');
    });
    it('should stringify empty options', function () {
      expect(stringifyFilterDescription('my_filter', [])).toBe('my_filter');
      expect(stringifyFilterDescription('my_filter', [null, void 0])).toBe('my_filter');
      expect(stringifyFilterDescription('my_filter', {
        a: null,
        b: void 0,
      })).toBe('my_filter');
      expect(stringifyFilterDescription('my_filter')).toBe('my_filter');
    });
  });
});
