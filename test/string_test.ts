import { escapeConcatFile, escapeFilterComponent } from '../src/string';
import { expect } from 'chai';

describe('escape', function () {
  describe('escapeConcatFile()', function () {
    it('should escape special characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m\\ a\\ string;,\\ with\\ many[special]:\\ characters";
      expect(escapeConcatFile(unescaped)).equals(escaped);
    });
    it('should escape special characters (non-string)', function () {
      // @ts-expect-error
      expect(escapeConcatFile({})).equals('[object\\ Object]');
    });
  });
  describe('escapeFilterComponent()', function () {
    it('should escape special characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m a string\\;\\, with many\\[special\\]\\: characters";
      expect(escapeFilterComponent(unescaped)).equals(escaped);
    });
    it('should escape special characters (non-string)', function () {
      // @ts-expect-error
      expect(escapeFilterComponent({})).equals('\\[object Object\\]');
    });
  });
});
