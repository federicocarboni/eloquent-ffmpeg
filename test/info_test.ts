import {
  getCodecs, getDecoders, getDemuxers, getEncoders, getFilters, getFormats, getMuxers,
  getPixelFormats, getVersion
} from '../src/info';

function isStringSet(set: Set<string>) {
  expect(set.size).toBeGreaterThan(1);
  set.forEach((s) => {
    expect(typeof s).toBe('string');
    expect(s).toMatch(/[a-z0-9_-][a-z0-9_-]+/);
  });
}

describe('info', function () {
  describe('getVersion()', function () {
    it('should return Version', async function () {
      const version = await getVersion();
      expect(typeof version.copyright).toBe('string');
      expect(typeof version.version).toBe('string');
      expect(version.configuration).toBeInstanceOf(Array);
      expect(typeof version.libavutil).toBe('string');
      expect(typeof version.libavcodec).toBe('string');
      expect(typeof version.libavformat).toBe('string');
      expect(typeof version.libavdevice).toBe('string');
      expect(typeof version.libavfilter).toBe('string');
      expect(typeof version.libswscale).toBe('string');
      expect(typeof version.libswresample).toBe('string');
      expect(typeof version.libpostproc).toBe('string');
    });
  });
  describe('getMuxers()', function () {
    it('should return a Set', async function () {
      const muxers = await getMuxers();
      expect(muxers).toBeInstanceOf(Set);
      isStringSet(muxers);
    });
  });
  describe('getDemuxers()', function () {
    it('should return a Set', async function () {
      const demuxers = await getDemuxers();
      expect(demuxers).toBeInstanceOf(Set);
      isStringSet(demuxers);
    });
  });
  describe('getFormats()', function () {
    it('should return a Set', async function () {
      const formats = await getFormats();
      expect(formats).toBeInstanceOf(Set);
      isStringSet(formats);
    });
  });
  describe('getEncoders()', function () {
    it('should return Codecs', async function () {
      const codecs = await getEncoders();
      expect(codecs.video).toBeInstanceOf(Set);
      isStringSet(codecs.video);
      expect(codecs.audio).toBeInstanceOf(Set);
      isStringSet(codecs.audio);
      expect(codecs.subtitle).toBeInstanceOf(Set);
      isStringSet(codecs.subtitle);
      expect(codecs.data).toBeInstanceOf(Set);
    });
  });
  describe('getDecoders()', function () {
    it('should return Codecs', async function () {
      const codecs = await getDecoders();
      expect(codecs.video).toBeInstanceOf(Set);
      isStringSet(codecs.video);
      expect(codecs.audio).toBeInstanceOf(Set);
      isStringSet(codecs.audio);
      expect(codecs.subtitle).toBeInstanceOf(Set);
      isStringSet(codecs.subtitle);
      expect(codecs.data).toBeInstanceOf(Set);
    });
  });
  describe('getPixelFormats()', function () {
    it('should return a Set', async function () {
      const pixelFormats = await getPixelFormats();
      expect(pixelFormats).toBeInstanceOf(Set);
      isStringSet(pixelFormats);
    });
  });
  describe('getFilters()', function () {
    it('should return Filters', async function () {
      const filters = await getFilters();
      expect(filters.video).toBeInstanceOf(Set);
      isStringSet(filters.video);
      expect(filters.audio).toBeInstanceOf(Set);
      isStringSet(filters.audio);
    });
  });
  describe('getCodecs()', function () {
    it('should return Codecs', async function () {
      const codecs = await getCodecs();
      expect(codecs.video).toBeInstanceOf(Set);
      isStringSet(codecs.video);
      expect(codecs.audio).toBeInstanceOf(Set);
      isStringSet(codecs.audio);
      expect(codecs.subtitle).toBeInstanceOf(Set);
      isStringSet(codecs.subtitle);
      expect(codecs.data).toBeInstanceOf(Set);
      isStringSet(codecs.data);
    });
  });
});
