import sharp from 'sharp';
import { MAX_DIMENSION, processImage } from './image.pipeline.js';

const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 120 } } })
    .withExif({ IFD0: { Copyright: 'secret-photographer', Make: 'SecretCam' } })
    .jpeg()
    .toBuffer();

describe('processImage', () => {
  it('re-encodes to AVIF, caps the longest side at 2560px and never upscales', async () => {
    const big = await processImage(await jpeg(3200, 1600));
    expect(big).toMatchObject({ contentType: 'image/avif', extension: 'avif', width: MAX_DIMENSION, height: 1280 });
    expect(await sharp(big.buffer).metadata()).toMatchObject({ format: 'heif', compression: 'av1' });
    const small = await processImage(await jpeg(300, 200));
    expect([small.width, small.height]).toEqual([300, 200]);
  });

  it('strips EXIF metadata from the output', async () => {
    const input = await jpeg(400, 400);
    expect((await sharp(input).metadata()).exif).toBeTruthy(); // the fixture really carries EXIF
    const out = await processImage(input);
    expect((await sharp(out.buffer).metadata()).exif).toBeUndefined();
    expect(out.buffer.includes(Buffer.from('secret-photographer'))).toBe(false);
  });

  it('applies EXIF orientation before dropping it', async () => {
    const rotated = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#888' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await processImage(rotated);
    expect([out.width, out.height]).toEqual([200, 400]);
  });

  it('keeps colour detail: a photo-like image survives with SSIM-level fidelity, not just the right size', async () => {
    // Fine noise is the hardest case for a lossy encoder; the output's mean channel values stay within a hair.
    const noisy = await sharp(Buffer.from(Array.from({ length: 256 * 256 * 3 }, (_, i) => (i * 7919) % 251)), { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
    const out = await processImage(noisy);
    const [a, b] = await Promise.all([sharp(noisy).stats(), sharp(out.buffer).stats()]);
    a.channels.slice(0, 3).forEach((c, i) => expect(Math.abs(c.mean - b.channels[i].mean)).toBeLessThan(2));
  });

  it('accepts PNG (with alpha) and GIF', async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
    await expect(processImage(png)).resolves.toMatchObject({ width: 50 });
    expect((await sharp((await processImage(png)).buffer).metadata()).hasAlpha).toBe(true);
    const gif = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).gif().toBuffer();
    await expect(processImage(gif)).resolves.toMatchObject({ width: 20 });
  });

  it.each([
    ['plain text renamed .jpg', Buffer.from('hello, I am not an image')],
    ['an SVG (script vector)', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ['HTML', Buffer.from('<html><script>alert(1)</script></html>')],
    ['an empty file', Buffer.alloc(0)],
    ['truncated garbage with a JPEG header', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('nonsense')])],
  ])('rejects %s with a friendly 400', async (_name, buf) => {
    await expect(processImage(buf)).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_IMAGE' } });
  });
});
