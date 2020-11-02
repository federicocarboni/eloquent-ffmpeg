import { getFFmpegPath, getFFprobePath, setFFmpegPath, setFFprobePath } from '../src/env';
import { expect } from 'chai';

describe('env', function () {
  describe('setFFmpegPath()', function () {
    it('should throw on an invalid path', function () {
      expect(() => setFFmpegPath('broken/:path')).to.throw(TypeError);
    });
    it('should accept a valid path', function () {
      const path = getFFmpegPath();
      expect(() => setFFmpegPath(__filename)).not.to.throw();
      setFFmpegPath(path);
    });
  });
  describe('setFFprobePath()', function () {
    it('should throw on an invalid path', function () {
      expect(() => setFFprobePath('broken/:path')).to.throw(TypeError);
    });
    it('should accept a valid path', function () {
      const path = getFFprobePath();
      expect(() => setFFprobePath(__filename)).not.to.throw();
      setFFprobePath(path);
    });
  });

  describe('getFFmpegPath()', function () {
    it('should return a string', function () {
      expect(getFFmpegPath()).to.be.a('string');
    });
  });
  describe('getFFprobePath()', function () {
    it('should return a string', function () {
      expect(getFFprobePath()).to.be.a('string');
    });
  });
});
