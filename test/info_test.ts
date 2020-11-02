import { getCodecs, getDecoders, getDemuxers, getEncoders, getFilters, getFormats, getMuxers, getPixelFormats, getVersion } from '../src/info';
import { expect } from 'chai';

function isStringSet(set: Set<string>) {
  expect(set.size).to.be.greaterThan(1);
  set.forEach((s) => {
    expect(s).to.be.a('string');
    expect(s).matches(/[a-z0-9_-][a-z0-9_-]+/);
  });
}

describe('info', function () {
  describe('getVersion()', function () {
    it('should return Version', async function () {
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
    it('should return a Set', async function () {
      const muxers = await getMuxers();
      expect(muxers).to.be.an.instanceOf(Set);
      isStringSet(muxers);
    });
  });
  describe('getDemuxers()', function () {
    it('should return a Set', async function () {
      const demuxers = await getDemuxers();
      expect(demuxers).to.be.an.instanceOf(Set);
      isStringSet(demuxers);
    });
  });
  describe('getFormats()', function () {
    it('should return a Set', async function () {
      const formats = await getFormats();
      expect(formats).to.be.an.instanceOf(Set);
      isStringSet(formats);
    });
  });
  describe('getEncoders()', function () {
    it('should return Codecs', async function () {
      const codecs = await getEncoders();
      expect(codecs.video).to.be.an.instanceOf(Set);
      isStringSet(codecs.video);
      expect(codecs.audio).to.be.an.instanceOf(Set);
      isStringSet(codecs.audio);
      expect(codecs.subtitle).to.be.an.instanceOf(Set);
      isStringSet(codecs.subtitle);
      expect(codecs.data).to.be.an.instanceOf(Set);
    });
  });
  describe('getDecoders()', function () {
    it('should return Codecs', async function () {
      const codecs = await getDecoders();
      expect(codecs.video).to.be.an.instanceOf(Set);
      isStringSet(codecs.video);
      expect(codecs.audio).to.be.an.instanceOf(Set);
      isStringSet(codecs.audio);
      expect(codecs.subtitle).to.be.an.instanceOf(Set);
      isStringSet(codecs.subtitle);
      expect(codecs.data).to.be.an.instanceOf(Set);
    });
  });
  describe('getPixelFormats()', function () {
    it('should return a Set', async function () {
      const pixelFormats = await getPixelFormats();
      expect(pixelFormats).to.be.an.instanceOf(Set);
      isStringSet(pixelFormats);
    });
  });
  describe('getFilters()', async function () {
    it('should return Filters', async function () {
      const filters = await getFilters();
      expect(filters.video).to.be.an.instanceOf(Set);
      isStringSet(filters.video);
      expect(filters.audio).to.be.an.instanceOf(Set);
      isStringSet(filters.audio);
    });
  });
  describe('getCodecs()', function () {
    it('should return Codecs', async function () {
      const codecs = await getCodecs();
      expect(codecs.video).to.be.an.instanceOf(Set);
      isStringSet(codecs.video);
      expect(codecs.audio).to.be.an.instanceOf(Set);
      isStringSet(codecs.audio);
      expect(codecs.subtitle).to.be.an.instanceOf(Set);
      isStringSet(codecs.subtitle);
      expect(codecs.data).to.be.an.instanceOf(Set);
      isStringSet(codecs.data);
    });
  });
});
