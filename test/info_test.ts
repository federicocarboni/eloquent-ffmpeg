import { getCodecs, getDemuxers, getFormats, getMuxers, getRawCodecs, getVersion } from '../src/info';
import { expect } from 'chai';

describe('info', function () {
  this.timeout(60000);
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
  describe('getMuxers()', function () {
    it('returns a Set', async function () {
      const muxers = await getMuxers();
      expect(muxers).to.be.an.instanceOf(Set);
    });
  });
  describe('getDemuxers()', function () {
    it('returns a Set', async function () {
      const demuxers = await getDemuxers();
      expect(demuxers).to.be.an.instanceOf(Set);
    });
  });
  describe('getFormats()', function () {
    it('returns a Set', async function () {
      const formats = await getFormats();
      expect(formats).to.be.an.instanceOf(Set);
    });
  });
  describe('getRawCodecs()', function () {
    it('returns a Set', async function () {
      const rawCodecs = await getRawCodecs();
      expect(rawCodecs).to.be.an.instanceOf(Set);
    });
  });
  describe('getCodecs()', function () {
    it('returns Codecs', async function () {
      const codecs = await getCodecs();
      expect(codecs.video).to.be.an.instanceOf(Set);
      expect(codecs.audio).to.be.an.instanceOf(Set);
      expect(codecs.subtitle).to.be.an.instanceOf(Set);
      expect(codecs.data).to.be.an.instanceOf(Set);
      console.log(codecs);
    });
  });
});
