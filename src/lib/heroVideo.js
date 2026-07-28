/**
 * Optional self-hosted hero loop for a project. Drop a `hero.mp4` (muted,
 * web-optimized, e.g. a timelapse) into src/media/projects/<slug>/ and the
 * project page leads with it as an autoplaying loop instead of a still. It's a
 * single filename (`hero.mp4`) so images.js doesn't glob it into the gallery.
 * Vimeo `video` still wins if both are set.
 */
const modules = import.meta.glob('../media/projects/*/hero.{mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const bySlug = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/projects\/([^/]+)\/hero\.(mp4|webm)$/);
  if (m) bySlug[m[1]] = url;
}

export function getHeroVideo(slug) {
  return bySlug[slug] || '';
}
