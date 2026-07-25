/**
 * Real project imagery in src/media/projects/<slug>/. Vite hashes + bundles
 * each file; the glob enumerates them so galleries build automatically.
 * `.gif` is included — GIFs flow through the same pipeline (hero thumbnail,
 * card, and gallery) and animate natively in <img>.
 */
const modules = import.meta.glob('../media/projects/*/*.{jpg,jpeg,png,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const bySlug = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/projects\/([^/]+)\/([^/]+)$/);
  if (!m) continue;
  const [, slug, file] = m;
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

export function getHero(slug, preferred) {
  return getImages(slug, preferred)[0] || '';
}

/** Basename of a legacy projects.json image path, or null. */
export const baseName = (p) => (p ? p.split('/').pop() : null);
