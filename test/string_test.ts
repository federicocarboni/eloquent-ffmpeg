import { escapeConcatFile, escapeFilterValue, stringifyFilterDescription } from '../src/string';

describe('string', function () {
  describe('escapeConcatFile()', function () {
    it('should escape special characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m\\ a\\ string;,\\ with\\ many[special]:\\ characters";
      expect(escapeConcatFile(unescaped)).toBe(escaped);
    });
  });
  describe('escapeFilterComponent()', function () {
    it('should escape special characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m\\ a\\ string\\;\\,\\ with\\ many\\[special\\]\\:\\ characters";
      expect(escapeFilterValue(unescaped)).toBe(escaped);
    });
  });
  describe('stringifySimpleFilterGraph()', function () {
    it('should stringify options array', function () {
      expect(stringifyFilterDescription('my_filter', ['opt1', 'opt2'])).toBe('my_filter=opt1:opt2');
      expect(stringifyFilterDescription('my_filter', ['opt1:', 'opt2'])).toBe('my_filter=opt1\\::opt2');
    });
    it('should stringify options record', function () {
      expect(stringifyFilterDescription('my_filter', { opt1: 'val1', opt2: 'val2' })).toBe('my_filter=opt1=val1:opt2=val2');
      expect(stringifyFilterDescription('my_filter', { opt1: 'val1:', opt2: 'val2' })).toBe('my_filter=opt1=val1\\::opt2=val2');
    });
    it('should stringify non-string values', function () {
      expect(stringifyFilterDescription('my_filter', [1, 2])).toBe('my_filter=1:2');
      expect(stringifyFilterDescription('my_filter', { opt1: 1, opt2: 2 })).toBe('my_filter=opt1=1:opt2=2');
    });
    it('should stringify empty options', function () {
      expect(stringifyFilterDescription('my_filter', [])).toBe('my_filter');
      expect(stringifyFilterDescription('my_filter', {})).toBe('my_filter');
      expect(stringifyFilterDescription('my_filter')).toBe('my_filter');
    });
  });
});
