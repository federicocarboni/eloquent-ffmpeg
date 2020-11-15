import { createReadStream, promises } from 'fs';
import { probe } from '../src/probe';

describe('probe', function () {
  describe('probe()', function () {
    it('should probe a buffer', async function () {
      const buffer = await promises.readFile('test/samples/video.mp4');
      const result = await probe(buffer);
      expect(result.format).toBe('mov,mp4,m4a,3gp,3g2,mj2');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.start).toBe('number');
      expect(result.score).toBe(100);
      expect(result.tags).toBeInstanceOf(Map);
      expect(typeof result.unwrap()).toBe('object');
    });
    it('should probe a readable stream', async function () {
      const result = await probe(createReadStream('test/samples/video.mp4'));
      expect(result.format).toBe('mov,mp4,m4a,3gp,3g2,mj2');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.start).toBe('number');
      expect(result.score).toBe(100);
      expect(result.tags).toBeInstanceOf(Map);
      expect(typeof result.unwrap()).toBe('object');
    });
    it('should probe a file by path', async function () {
      const result = await probe('test/samples/video.mp4');
      expect(result.format).toBe('mov,mp4,m4a,3gp,3g2,mj2');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.start).toBe('number');
      expect(result.score).toBe(100);
      expect(result.tags).toBeInstanceOf(Map);
      expect(typeof result.unwrap()).toBe('object');
    });
    it('should probe a custom analyzeDuration', async function () {
      const result = await probe('test/samples/video.mp4', {
        analyzeDuration: 30000,
      });
      expect(result.format).toBe('mov,mp4,m4a,3gp,3g2,mj2');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.start).toBe('number');
      expect(result.score).toBe(100);
      expect(result.tags).toBeInstanceOf(Map);
      expect(typeof result.unwrap()).toBe('object');
    });
    it('should probe an image stream', async function () {
      const result = await probe(createReadStream('test/samples/image.webp'), {
        format: 'image2pipe',
      });
      expect(result.format).toBe('image2pipe');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.start).toBe('number');
      expect(typeof result.score).toBe('number');
      expect(result.tags).toBeUndefined();
      expect(typeof result.unwrap()).toBe('object');
    });
    it('should throw on invalid input path', async function () {
      let caught = false;
      try {
        await probe('test/samples/invalid');
      } catch {
        caught = true;
      }
      expect(caught).toBe(true);
    });
    it('should throw on invalid input stream', async function () {
      let caught = false;
      try {
        await probe(createReadStream('test/samples/invalid'));
      } catch {
        caught = true;
      }
      expect(caught).toBe(true);
    });
    it('should throw on invalid input buffer', async function () {
      let caught = false;
      try {
        await probe(await promises.readFile('test/samples/invalid'));
      } catch {
        caught = true;
      }
      expect(caught).toBe(true);
    });
  });
});
