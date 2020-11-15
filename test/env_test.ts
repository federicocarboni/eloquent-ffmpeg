import { getFFmpegPath, getFFprobePath, setFFmpegPath, setFFprobePath } from '../src/env';

describe('env', function () {
  describe('setFFmpegPath()', function () {
    it('should throw on an invalid path', function () {
      expect(() => setFFmpegPath('broken/:path')).toThrow(TypeError);
    });
    it('should accept a valid path', function () {
      const path = getFFmpegPath();
      expect(() => setFFmpegPath(__filename)).not.toThrow();
      setFFmpegPath(path);
    });
  });
  describe('setFFprobePath()', function () {
    it('should throw on an invalid path', function () {
      expect(() => setFFprobePath('broken/:path')).toThrow(TypeError);
    });
    it('should accept a valid path', function () {
      const path = getFFprobePath();
      expect(() => setFFprobePath(__filename)).not.toThrow();
      setFFprobePath(path);
    });
  });

  describe('getFFmpegPath()', function () {
    it('should return a string', function () {
      expect(typeof getFFmpegPath()).toBe('string');
    });
  });
  describe('getFFprobePath()', function () {
    it('should return a string', function () {
      expect(typeof getFFprobePath()).toBe('string');
    });
  });
});
