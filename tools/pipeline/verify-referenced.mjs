#!/usr/bin/env node
/**
 * DISABLED STUB. The pack's real `verify-referenced.mjs` lives unmodified at
 * `studio-systems-pack/04-media-pipeline/scripts/verify-referenced.mjs`.
 *
 * ── Why it is not used here ──
 *
 * That script is a pre-ship gate: every media URL the BUILT site references must
 * exist and be non-empty in object storage. It works by TEXT-SCANNING `dist/`,
 * and it states its own assumption plainly:
 *
 *   "client JS builds NO media URLs at runtime, so a text scan of dist
 *    captures 100% of what browsers request."
 *
 * **That assumption is false for this repo.** Since Phase B, every media URL is
 * assembled at runtime by `src/lib/mediaManifest.js`:
 *
 *   `${BASE}projects/${encodeURIComponent(slug)}/${encodeURIComponent(file)}`
 *
 * Measured 2026-08-09: `dist/` contains **ZERO** complete media URLs — only the
 * template fragment and the manifest data. So the scanner would find nothing to
 * check and exit 0, reporting a pass. A gate that passes because it never looked
 * is worse than no gate: it is incident A2, "missing input must be a loud skip,
 * never a verdict."
 *
 * ── What to build instead (Phase C) ──
 *
 * Derive the expected object list from `src/data/media-manifest.json`, which is
 * precisely the thing that knows what the site references, and HEAD each key
 * against the bucket. Assert non-empty as well as present: a 0-byte object
 * returns 200 and renders as a broken image with no fallback.
 *
 * Do NOT re-copy the vault version over this file.
 */
console.error('[verify-referenced] DISABLED for this repo.');
console.error('[verify-referenced] It text-scans dist/ for media URLs; since Phase B this build');
console.error('[verify-referenced] contains ZERO literal media URLs, so it would report a pass');
console.error('[verify-referenced] having checked nothing. Read this file for the reasoning.');
console.error('[verify-referenced] Needed instead: a manifest-driven verifier (Phase C, unwritten).');
process.exit(2);
