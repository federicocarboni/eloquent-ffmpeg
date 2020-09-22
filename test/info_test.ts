import { getVersion } from '../src/info';
import { expect } from 'chai';

describe('info', function () {
  describe('getVersion()', function () {
    it('returns information', async function () {
      const version = await getVersion();
      expect(version.copyright).to.be.a('string');
      expect(version.version).to.be.a('string');
      expect(version.configuration).to.be.an.instanceOf(Array);
      expect(version.libavutil).to.be.a('string');
      expect(version.libavcodec).to.be.a('string');
      expect(version.libavformat).to.be.a('string');
      expect(version.libavdevice).to.be.a('string');
      expect(version.libavfilter).to.be.a('string');
      expect(version.libswscale).to.be.a('string');
      expect(version.libswresample).to.be.a('string');
      expect(version.libpostproc).to.be.a('string');
    });
  });
});
