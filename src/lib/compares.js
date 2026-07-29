/**
 * Before/after VFX pairs for the project-page A/B slider. Drop matched media
 * into src/media/projects/<slug>/compare/ named `NN-clean.<ext>` (the plate)
 * and `NN-final.<ext>` (the composite). Stills (jpg/png/webp) OR frame-synced
 * loop videos (mp4/webm) both work. They live in a sub-folder so images.js
 * (which globs one level deep) leaves them out of the normal gallery.
 */
const modules = import.meta.glob('../media/projects/*/compare/*.{jpg,jpeg,png,webp,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const isVideo = (url) => /\.(mp4|webm)(\?|$)/i.test(url);

/**
 * Per-project wording for the compare section. Defaults suit a shot VFX
 * breakdown (filmed plate → composite); CG projects comparing a work-in-
 * progress render against the final override it.
 */
const LABELS = {
  asur: { before: 'WIP', after: 'Final', heading: 'WIP → Final' },
};
const DEFAULT_LABELS = { before: 'Plate', after: 'Final', heading: 'Plate → Final' };

export const getCompareLabels = (slug) => LABELS[slug] || DEFAULT_LABELS;

const bySlug = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/projects\/([^/]+)\/compare\/([^/]+)$/);
  if (!m) continue;
  const [, slug, file] = m;
  (bySlug[slug] ||= []).push({ file, url });
}

/** Ordered [{ before, after }] pairs for a slug (only complete pairs). */
export function getCompares(slug) {
  const groups = {};
  for (const { file, url } of bySlug[slug] || []) {
    const m = file.match(/^(\d+)-(clean|final)\./i);
    if (!m) continue;
    (groups[m[1]] ||= {})[m[2].toLowerCase()] = url;
  }
  return Object.keys(groups)
    .sort()
    .map((k) => groups[k])
    .filter((g) => g.clean && g.final)
    .map((g) => ({ before: g.clean, after: g.final, video: isVideo(g.final) }));
}
