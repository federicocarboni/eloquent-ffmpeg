import { ProbeResult } from '../src/types';
import { probe } from '../src/probe';
import { expect } from 'chai';
import { join } from 'path';

describe('probe', function () {
  describe('probe()', function () {
    it('should return an instance of ProbeResult', async function () {
      const result = await probe(join(__dirname, 'assets/video.mp4'));
      expect(result).to.be.an.instanceOf(ProbeResult);
    });
  });
});
