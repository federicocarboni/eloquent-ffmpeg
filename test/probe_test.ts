import { probe } from '../src/probe';
import { join } from 'path';
import { promises } from 'fs';
import { expect } from 'chai';
import { randomBytes } from 'crypto';

describe('probe', function () {
  describe('probe()', function () {
    it('should return a ProbeResult', async function () {
      const buffer = await promises.readFile(join(__dirname, 'samples/video.mp4'));
      const result = await probe(buffer);
      expect(result.format).to.equal('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.duration).to.be.a('number');
      expect(result.start).to.be.a('number');
      expect(result.score).to.equal(100);
      expect(result.tags).to.be.an.instanceOf(Map);
      expect(result.unwrap()).to.be.an('object');
    });
    it('should throw on invalid input', async function () {
      const buffer = randomBytes(6 * 1024 * 1024);
      let caught = false;
      try {
        await probe(buffer);
      } catch {
        caught = true;
      }
      expect(caught).to.equal(true);
    });
  });
});
