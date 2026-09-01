/**
 * The media data layer's single source of truth.
 *
 * WHY THIS REPLACED `import.meta.glob`
 * ------------------------------------
 * The gallery, hero-loop and compare lookups used to enumerate files with
 * `import.meta.glob`, which is a DISK SCAN performed at build time. That is
 * correct only while the media is committed and therefore present wherever the
 * build runs. Once media lives in object storage, the scan returns `{}` on the
 * build runner — not an error, just nothing — and the site builds green with
 * every gallery empty.
 *
 * So what exists is computed on the machine that has the media, written to
 * `src/data/media-manifest.json`, and committed. This module reads that file
 * and nothing else. It never touches the disk.
 *
 * Regenerate with: `npm run media:manifest`
 */
import manifest from '../data/media-manifest.json';

// ── Fail safe, not open ──────────────────────────────────────────────────────
// A missing manifest is already a hard build error (the import above cannot
// resolve). The dangerous case is a manifest that EXISTS and is empty: every
// lookup would return nothing, every gallery would render blank, and the build
// would stay green. Refuse at module load instead, loudly.
if (!manifest || typeof manifest !== 'object' || !manifest.projects) {
  throw new Error(
    '[mediaManifest] src/data/media-manifest.json is missing its `projects` key. '
    + 'Regenerate it with `npm run media:manifest` on a machine that has the media.',
  );
}
if (Object.keys(manifest.projects).length === 0) {
  throw new Error(
    '[mediaManifest] src/data/media-manifest.json contains NO projects. '
    + 'This is almost always a manifest regenerated where the media tree was absent — '
    + 'shipping it would produce a green build with empty galleries. '
    + 'Restore it (`git checkout -- src/data/media-manifest.json`) or regenerate it '
    + 'on a machine that has the media.',
  );
}

/**
 * Where media is served from.
 *
 * Local / current: media sits in `public/projects/`, so the site's own base URL
 * is correct and everything works offline.
 * Phase C: set `VITE_MEDIA_BASE_URL` to the CDN origin and the same manifest
 * drives CDN URLs with no other change.
 */
const RAW_BASE = import.meta.env.VITE_MEDIA_BASE_URL || import.meta.env.BASE_URL || '/';
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;

/** Public URL for one media file. Encoded, because filenames come from disk. */
export const mediaUrl = (slug, file) =>
  `${BASE}projects/${encodeURIComponent(slug)}/${encodeURIComponent(file)}`;

/** URL for a file inside a project's `compare/` sub-folder. */
export const compareUrl = (slug, file) =>
  `${BASE}projects/${encodeURIComponent(slug)}/compare/${encodeURIComponent(file)}`;

/** URL for an about-page image. */
export const aboutUrl = (file) => `${BASE}about/${encodeURIComponent(file)}`;

/** Raw manifest entry for a slug, or an empty shape. Never null. */
export const projectEntry = (slug) => manifest.projects[slug] || { files: [], compare: [] };

/** Every about-page image filename, sorted. */
export const aboutFiles = () => manifest.about || [];

export default manifest;
