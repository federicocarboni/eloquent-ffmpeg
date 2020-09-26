import { escapeFilterComponent, stringifySimpleFilter } from '../src/filters';
import { expect } from 'chai';

describe('filters', function () {
  describe('escapeFilterComponent()', function () {
    it('should escape invalid characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m a string\\;\\, with many\\[special\\]\\: characters";
      expect(escapeFilterComponent(unescaped)).equals(escaped);
    });
  });
  describe('stringifySimpleFilter()', function () {
    it('should stringify options array', function () {
      expect(stringifySimpleFilter('my_filter', ['opt1', 'opt2'])).equals('my_filter=opt1:opt2');
      expect(stringifySimpleFilter('my_filter', ['opt1:', 'opt2'])).equals('my_filter=opt1\\::opt2');
    });
    it('should stringify options record', function () {
      expect(stringifySimpleFilter('my_filter', { opt1: 'val1', opt2: 'val2' })).equals('my_filter=opt1=val1:opt2=val2');
      expect(stringifySimpleFilter('my_filter', { opt1: 'val1:', opt2: 'val2' })).equals('my_filter=opt1=val1\\::opt2=val2');
    });
    it('should stringify empty options', function () {
      expect(stringifySimpleFilter('my_filter', [])).equals('my_filter');
      expect(stringifySimpleFilter('my_filter', {})).equals('my_filter');
      expect(stringifySimpleFilter('my_filter')).equals('my_filter');
    });
  });
});
