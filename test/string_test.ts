import { escapeConcatFile, escapeFilterComponent } from '../src/string';
// import { expect } from 'chai';

describe('escape', function () {
  describe('escapeConcatFile()', function () {
    it('should escape special characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m\\ a\\ string;,\\ with\\ many[special]:\\ characters";
      expect(escapeConcatFile(unescaped)).toBe(escaped);
    });
    it('should escape special characters (non-string)', function () {
      // @ts-expect-error
      expect(escapeConcatFile({})).toBe('[object\\ Object]');
    });
  });
  describe('escapeFilterComponent()', function () {
    it('should escape special characters', function () {
      const unescaped = "I'm a string;, with many[special]: characters";
      const escaped = "I\\'m\\ a\\ string\\;\\,\\ with\\ many\\[special\\]\\:\\ characters";
      expect(escapeFilterComponent(unescaped)).toBe(escaped);
    });
    it('should escape special characters (non-string)', function () {
      // @ts-expect-error
      expect(escapeFilterComponent({})).toBe('\\[object\\ Object\\]');
    });
  });
});
