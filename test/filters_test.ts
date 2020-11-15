import { stringifySimpleFilterGraph } from '../src/filters';

describe('filters', function () {
  describe('stringifySimpleFilterGraph()', function () {
    it('should stringify options array', function () {
      expect(stringifySimpleFilterGraph('my_filter', ['opt1', 'opt2'])).toBe('my_filter=opt1:opt2');
      expect(stringifySimpleFilterGraph('my_filter', ['opt1:', 'opt2'])).toBe('my_filter=opt1\\::opt2');
    });
    it('should stringify options record', function () {
      expect(stringifySimpleFilterGraph('my_filter', { opt1: 'val1', opt2: 'val2' })).toBe('my_filter=opt1=val1:opt2=val2');
      expect(stringifySimpleFilterGraph('my_filter', { opt1: 'val1:', opt2: 'val2' })).toBe('my_filter=opt1=val1\\::opt2=val2');
    });
    it('should stringify non-string values', function () {
      expect(stringifySimpleFilterGraph('my_filter', [1, 2])).toBe('my_filter=1:2');
      expect(stringifySimpleFilterGraph('my_filter', { opt1: 1, opt2: 2 })).toBe('my_filter=opt1=1:opt2=2');
    });
    it('should stringify empty options', function () {
      expect(stringifySimpleFilterGraph('my_filter', [])).toBe('my_filter');
      expect(stringifySimpleFilterGraph('my_filter', {})).toBe('my_filter');
      expect(stringifySimpleFilterGraph('my_filter')).toBe('my_filter');
    });
  });
});
