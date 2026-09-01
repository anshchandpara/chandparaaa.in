/**
 * Real project media, served from `public/projects/<slug>/`.
 *
 * Enumeration comes from the COMMITTED manifest (`lib/mediaManifest.js`), not
 * from a disk scan — see that file for why. Behaviour is otherwise unchanged:
 *
 * `.gif` flows through as a normal still (animates natively in <img>).
 * `.mp4`/`.webm` are **silent gallery loops** — far better than a GIF for
 * smooth gradients (no 256-colour banding, a fraction of the weight). They sit
 * in filename order alongside the stills; `getHero` skips them so masonry
 * cards and thumbnails always resolve to a real image.
 *
 * `hero.mp4`/`hero.webm` is reserved for the page hero (lib/heroVideo.js) and
 * is excluded from the gallery by the manifest builder, so it is never shown
 * twice.
 */
import { projectEntry, mediaUrl } from './mediaManifest';

/** True for a URL that points at a video file. */
export const isVideoSrc = (url) => /\.(mp4|webm)(\?|#|$)/i.test(url || '');

export function hasImages(slug) {
  return projectEntry(slug).files.length > 0;
}

/**
 * Ordered image URLs for a slug. If `preferred` (a filename) is supplied and
 * present, it's moved to the front so it becomes the hero/thumbnail.
 *
 * Files are already sorted by `localeCompare` in the manifest builder, matching
 * the ordering the glob-based version produced.
 */
export function getImages(slug, preferred) {
  const files = projectEntry(slug).files;
  if (!files.length) return [];
  const urls = files.map((file) => mediaUrl(slug, file));
  if (preferred) {
    const i = files.indexOf(preferred);
    if (i > 0) return [urls[i], ...urls.slice(0, i), ...urls.slice(i + 1)];
  }
  return urls;
}

/** First still for a slug — skips gallery loops, so cards never get a video. */
export function getHero(slug, preferred) {
  return getImages(slug, preferred).find((url) => !isVideoSrc(url)) || '';
}

/** Basename of a legacy projects.json image path, or null. */
export const baseName = (p) => (p ? p.split('/').pop() : null);
