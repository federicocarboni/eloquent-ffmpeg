import { getFFmpegPath, getFFprobePath, setFFmpegPath, setFFprobePath } from '../src/env';
import { expect } from 'chai';

describe('env', function () {
  describe('setFFmpegPath()', function () {
    it('throws on an invalid path', function () {
      expect(() => setFFmpegPath('broken/:path')).to.throw(TypeError);
    });
  });
  describe('setFFprobePath()', function () {
    it('throws on an invalid path', function () {
      expect(() => setFFprobePath('broken/:path')).to.throw(TypeError);
    });
  });

  describe('getFFmpegPath()', function () {
    it('returns a string', function () {
      expect(getFFmpegPath()).to.be.a('string');
    });
  });
  describe('getFFprobePath()', function () {
    it('returns a string', function () {
      expect(getFFprobePath()).to.be.a('string');
    });
  });
});
