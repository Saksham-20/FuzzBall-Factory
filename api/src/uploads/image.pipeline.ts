import sharp from 'sharp';
import { badRequest } from '../common/errors.js';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Longest side kept: sharp on a large retina screen and on the product page's zoom. */
export const MAX_DIMENSION = 2560;
/**
 * The stored file is the master every displayed size is cut from (next/image re-encodes it per width), so it is kept
 * close to the original: AVIF at quality 74 with full-resolution colour (4:4:4). On the maker's photos that is 13%
 * larger than WebP 82 was, with clearly less loss (SSIM 0.990 against 0.974). Effort 3 encodes a 12 MP phone photo in
 * under a second on a laptop core and about 4 seconds on the live server's one vCPU; effort 4 is about 5x slower for
 * the same fidelity.
 */
const AVIF = { quality: 74, effort: 3, chromaSubsampling: '4:4:4' } as const;
/** Container formats accepted on input (checked from the file's bytes, never from the client-declared type). */
const ALLOWED_INPUT = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);
/** Decompression-bomb guard: refuse anything over ~50 megapixels before decoding. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: 'image/avif';
  extension: 'avif';
  width: number;
  height: number;
}

/**
 * Every upload is decoded and re-encoded: this is what makes an uploaded "image" safe to serve.
 *  - the real format is sniffed from the bytes (a renamed .exe/.svg/.html fails here)
 *  - EXIF orientation is applied, then ALL metadata (GPS, camera, thumbnails) is dropped
 *  - longest side capped at 2560px (never upscaled); output is AVIF (alpha preserved)
 *  - animated GIFs keep their first frame only
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const invalid = () => badRequest('That file is not a picture we can use. Upload a JPG, PNG or WebP image.', undefined, 'INVALID_IMAGE');
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
    const meta = await image.metadata();
    if (!meta.format || !ALLOWED_INPUT.has(meta.format)) throw invalid();
    const { data, info } = await image
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .avif(AVIF)
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, contentType: 'image/avif', extension: 'avif', width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof Error && 'getStatus' in err) throw err;
    throw invalid();
  }
}
