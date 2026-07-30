/**
 * Real project media in src/media/projects/<slug>/. Vite hashes + bundles each
 * file; the glob enumerates them so galleries build automatically.
 * `.gif` flows through as a normal still (animates natively in <img>).
 * `.mp4`/`.webm` are **silent gallery loops** — far better than a GIF for
 * smooth gradients (no 256-colour banding, a fraction of the weight). They sit
 * in filename order alongside the stills; `getHero` skips them so masonry
 * cards and thumbnails always resolve to a real image.
 */
const modules = import.meta.glob('../media/projects/*/*.{jpg,jpeg,png,webp,gif,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** True for a bundled URL that points at a video file. */
export const isVideoSrc = (url) => /\.(mp4|webm)(\?|#|$)/i.test(url || '');

const bySlug = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/projects\/([^/]+)\/([^/]+)$/);
  if (!m) continue;
  const [, slug, file] = m;
  // `hero.mp4`/`hero.webm` is reserved for the page hero (lib/heroVideo.js) —
  // keep it out of the gallery so it isn't shown twice.
  if (/^hero\.(mp4|webm)$/i.test(file)) continue;
  (bySlug[slug] ||= []).push({ file, url });
}
for (const k in bySlug) bySlug[k].sort((a, b) => a.file.localeCompare(b.file));

export function hasImages(slug) {
  return !!(bySlug[slug] && bySlug[slug].length);
}

/**
 * Ordered image URLs for a slug. If `preferred` (a filename) is supplied and
 * present, it's moved to the front so it becomes the hero/thumbnail.
 */
export function getImages(slug, preferred) {
  const arr = bySlug[slug] || [];
  if (!arr.length) return [];
  if (preferred) {
    const i = arr.findIndex((x) => x.file === preferred);
    if (i > 0) {
      return [arr[i].url, ...arr.slice(0, i).map((x) => x.url), ...arr.slice(i + 1).map((x) => x.url)];
    }
  }
  return arr.map((x) => x.url);
}

/** First still for a slug — skips gallery loops, so cards never get a video. */
export function getHero(slug, preferred) {
  return getImages(slug, preferred).find((url) => !isVideoSrc(url)) || '';
}

/** Basename of a legacy projects.json image path, or null. */
export const baseName = (p) => (p ? p.split('/').pop() : null);
