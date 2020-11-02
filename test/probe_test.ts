import { createReadStream, promises } from 'fs';
import { probe } from '../src/probe';
import { expect } from 'chai';

describe('probe', function () {
  describe('probe()', function () {
    this.timeout(10000);
    it('should probe a buffer', async function () {
      const buffer = await promises.readFile('test/samples/video.mp4');
      const result = await probe(buffer);
      expect(result.format).to.equal('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.duration).to.be.a('number');
      expect(result.start).to.be.a('number');
      expect(result.score).to.equal(100);
      expect(result.tags).to.be.an.instanceOf(Map);
      expect(result.unwrap()).to.be.an('object');
    });
    it('should probe a readable stream', async function () {
      const result = await probe(createReadStream('test/samples/video.mp4'));
      expect(result.format).to.equal('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.duration).to.be.a('number');
      expect(result.start).to.be.a('number');
      expect(result.score).to.equal(100);
      expect(result.tags).to.be.an.instanceOf(Map);
      expect(result.unwrap()).to.be.an('object');
    });
    it('should probe a file by path', async function () {
      const result = await probe('test/samples/video.mp4');
      expect(result.format).to.equal('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.duration).to.be.a('number');
      expect(result.start).to.be.a('number');
      expect(result.score).to.equal(100);
      expect(result.tags).to.be.an.instanceOf(Map);
      expect(result.unwrap()).to.be.an('object');
    });
    it('should probe a custom analyzeDuration', async function () {
      const result = await probe('test/samples/video.mp4', {
        analyzeDuration: 30000,
      });
      expect(result.format).to.equal('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.duration).to.be.a('number');
      expect(result.start).to.be.a('number');
      expect(result.score).to.equal(100);
      expect(result.tags).to.be.an.instanceOf(Map);
      expect(result.unwrap()).to.be.an('object');
    });
    it('should probe an image stream', async function () {
      const result = await probe(createReadStream('test/samples/image.webp'), {
        format: 'image2pipe',
      });
      expect(result.format).to.equal('image2pipe');
      expect(result.duration).to.be.a('number');
      expect(result.start).to.be.a('number');
      expect(result.unwrap()).to.be.an('object');
    });
    it('should throw on invalid input path', async function () {
      let caught = false;
      try {
        await probe('test/samples/invalid');
      } catch {
        caught = true;
      }
      expect(caught).to.equal(true);
    });
    it('should throw on invalid input stream', async function () {
      let caught = false;
      try {
        await probe(createReadStream('test/samples/invalid'));
      } catch {
        caught = true;
      }
      expect(caught).to.equal(true);
    });
    it('should throw on invalid input buffer', async function () {
      let caught = false;
      try {
        await probe(await promises.readFile('test/samples/invalid'));
      } catch {
        caught = true;
      }
      expect(caught).to.equal(true);
    });
  });
});
