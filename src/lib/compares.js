/**
 * Before/after VFX pairs for the project-page A/B slider. Drop matched media
 * into `public/projects/<slug>/compare/` named `NN-clean.<ext>` (the plate)
 * and `NN-final.<ext>` (the composite). Stills (jpg/png/webp) OR frame-synced
 * loop videos (mp4/webm) both work. They live in a sub-folder so the gallery
 * (which only lists files one level deep) leaves them out.
 *
 * Enumeration comes from the committed manifest, not a disk scan — see
 * `lib/mediaManifest.js`.
 */
import { projectEntry, compareUrl } from './mediaManifest';

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

/** Ordered [{ before, after }] pairs for a slug (only complete pairs). */
export function getCompares(slug) {
  const groups = {};
  for (const file of projectEntry(slug).compare || []) {
    const m = file.match(/^(\d+)-(clean|final)\./i);
    if (!m) continue;
    (groups[m[1]] ||= {})[m[2].toLowerCase()] = compareUrl(slug, file);
  }
  return Object.keys(groups)
    .sort()
    .map((k) => groups[k])
    .filter((g) => g.clean && g.final)
    .map((g) => ({ before: g.clean, after: g.final, video: isVideo(g.final) }));
}
