/**
 * Image loader for next/image (wired in next.config.ts).
 *
 * Cloudinary pictures are resized and re-encoded by Cloudinary itself (`f_auto` picks AVIF or WebP per browser,
 * `q_auto` the quality), so they never touch this site's small Node process. Everything else (the maker's local
 * uploads, the sample photos, the brand marks) goes through Next's own optimiser, exactly as the default loader.
 */
const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (CLOUDINARY.test(src)) {
    const marker = "/image/upload/";
    const at = src.indexOf(marker) + marker.length;
    const rest = src.slice(at);
    // A URL that already carries a transformation (`w_400,c_fill/...`) is left to its author.
    if (/^[a-z]{1,3}_[^/]*\//.test(rest)) return src;
    return `${src.slice(0, at)}f_auto,q_${quality ?? "auto"},w_${width},c_limit/${rest}`;
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
