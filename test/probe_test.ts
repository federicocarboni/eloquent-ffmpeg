import { ProbeResult } from '../src/probe/result';
import { probe } from '../src/probe/mod';
import { expect } from 'chai';
import { join } from 'path';
import { promises } from 'fs';

describe('probe', function () {
  describe('probe()', function () {
    it('should return an instance of ProbeResult', async function () {
      const buffer = await promises.readFile(join(__dirname, 'samples/video.mp4'));
      const result = await probe(buffer);
      expect(result).to.be.an.instanceOf(ProbeResult);
    });
  });
});
