#!/usr/bin/env node
/**
 * optimize-images.mjs — Batch 4b + B3 width-ladder
 *
 * Walks `public/projects/` and emits optimized siblings into
 * `public/projects-opt/` preserving the full directory tree. Originals
 * are never touched.
 *
 * For every source .jpg / .jpeg / .png we emit, at the mirrored path:
 *
 *   NATIVE (un-suffixed, full source resolution):
 *     • <name>.jpg / <name>.png   — primary fallback
 *     • <name>.webp
 *     • <name>.avif
 *
 *   WIDTH-LADDER RUNGS (B3): for every LADDER width strictly smaller than
 *   the source's oriented width, a down-scaled sibling per format:
 *     • <name>-<w>.jpg / <name>-<w>.png
 *     • <name>-<w>.webp
 *     • <name>-<w>.avif
 *
 * The un-suffixed file stays the FULL-resolution image (the top descriptor
 * of every srcset); the rungs let phones/tablets pull a candidate sized
 * for their slot instead of the multi-MB master. `sizes` per block is
 * supplied at the callsite (see `framer-image.ts` SIZES_* + MediaSlot).
 *
 * MANIFEST: because `public/projects-opt/` is gitignored (R2 is the source
 * of truth) it does NOT exist in the Cloudflare Pages build environment.
 * The runtime resolver (`src/lib/optimized-image.ts`) therefore can't
 * `existsSync` the rungs in production. So this script writes a tracked
 * manifest at `src/data/image-ladder.json` mapping every processed stem to
 * its native width + the rung widths emitted + the primary fallback ext.
 * The resolver reads that manifest to build srcsets. Commit the manifest
 * alongside any new masters. Incremental runs (--only=<slug>) MERGE into
 * the existing manifest rather than clobbering it.
 *
 * PNGs with alpha keep a re-optimized PNG primary; opaque PNGs and JPEGs
 * use a mozjpeg JPG primary.
 *
 * Sharp is present via Astro 6's default image service.
 *
 * Idempotent BY CONTENT (2026-06-10): the manifest stores an `h` md5 of
 * each source's bytes. Unchanged source + all outputs present → skipped
 * without decoding. Changed bytes under the SAME filename → every old
 * sibling is deleted first (no mixed-generation rungs), then the full
 * set re-emits. Entries from before hashing adopt the current source as
 * truth without re-encoding (legacy migration). --force still re-encodes
 * everything.
 *
 * Usage:  node scripts/optimize-images.mjs
 *         node scripts/optimize-images.mjs --dry-run
 *         node scripts/optimize-images.mjs --only=season-one
 *         node scripts/optimize-images.mjs --force            # re-encode all
 *         node scripts/optimize-images.mjs --concurrency=6
 */
import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, relative, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Two levels up: this file lives at <repo>/tools/pipeline/ (upstream it was
// <repo>/scripts/, where a single '..' was correct).
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC_DIR = join(ROOT, 'public', 'projects');
const OUT_DIR = join(ROOT, 'public', 'projects-opt');
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'image-ladder.json');

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
// Optional --only=<slug> flag to scope processing to one project's
// subfolder. Useful during the master-derived migration where most
// projects don't change between runs. Merges into the existing manifest.
const ONLY_FLAG = process.argv.find((a) => a.startsWith('--only='));
const ONLY = ONLY_FLAG ? ONLY_FLAG.slice('--only='.length) : null;
const CONC_FLAG = process.argv.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = CONC_FLAG
  ? Math.max(1, parseInt(CONC_FLAG.slice('--concurrency='.length), 10) || 0)
  : Math.max(2, Math.min(6, cpus().length - 2));

// B3 width ladder. Rungs strictly smaller than the source's oriented
// width get a down-scaled sibling; the un-suffixed native is the top
// srcset descriptor. Keep in sync with the filename scheme the resolver
// (`src/lib/optimized-image.ts`) expects: `<stem>-<w>.<fmt>` for rungs,
// `<stem>.<fmt>` for native.
const LADDER = [400, 800, 1200, 1600, 2400];

const JPG_EXTS = new Set(['.jpg', '.jpeg']);
const PNG_EXTS = new Set(['.png']);
const SRC_EXTS = new Set([...JPG_EXTS, ...PNG_EXTS]);

/** Recursive walker — yields every file path under `dir`. */
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

/** Format bytes as a friendly string. */
function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

/** Apply the primary encoder (mozjpeg or optimized PNG) to a pipeline. */
function encodePrimary(pipeline, primaryExt) {
  return primaryExt === 'png'
    ? pipeline.png({ compressionLevel: 9, palette: true, quality: 90 })
    : pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true });
}

/**
 * Encode `srcBuf` to `outPath` at `width` (or native when width is null)
 * in the format implied by the extension. Writes the encoded buffer
 * directly (the old `sharp(buf).toFile()` round-trip silently re-encoded
 * with DEFAULT params, dropping the tuned quality/effort — fixed here).
 * Returns the bytes written, or 0 when skipped (already exists / dry-run).
 */
async function emit(srcBuf, outPath, fmtKind, primaryExt, width, forceFile = false) {
  if (!FORCE && !forceFile && existsSync(outPath)) return { bytes: 0, skipped: true };

  let pipeline = sharp(srcBuf).rotate();
  if (width != null) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true });
  }
  if (fmtKind === 'avif') {
    pipeline = pipeline.avif({ quality: 60, effort: 6, chromaSubsampling: '4:2:0' });
  } else if (fmtKind === 'webp') {
    pipeline = pipeline.webp({ quality: 82, effort: 6 });
  } else {
    pipeline = encodePrimary(pipeline, primaryExt);
  }
  const buf = await pipeline.toBuffer();
  if (!DRY) await writeFile(outPath, buf);
  return { bytes: buf.byteLength, skipped: false };
}

/** Delete every existing optimized sibling of `stem` in `outSubdir`
 *  (native `<stem>.<fmt>` + any `<stem>-<NNN>.<fmt>` rung, ANY width —
 *  including rungs the new source no longer produces). Prefix-safe:
 *  `loop-01` never matches `loop-01-poster.*` because the suffix must be
 *  purely numeric. */
async function deleteSiblings(stem, outSubdir) {
  if (!existsSync(outSubdir)) return 0;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(?:-\\d{2,4})?\\.(?:jpe?g|png|webp|avif)$`);
  let removed = 0;
  for (const f of await readdir(outSubdir)) {
    if (re.test(f)) {
      if (!DRY) await unlink(join(outSubdir, f));
      removed++;
    }
  }
  return removed;
}

async function processOne(srcPath, manifest) {
  const ext = extname(srcPath).toLowerCase();
  if (!SRC_EXTS.has(ext)) return null;

  const rel = relative(SRC_DIR, srcPath);
  const relDir = dirname(rel);
  const stem = basename(rel, ext);
  const stemKey = rel.slice(0, rel.length - ext.length).split(sep).join('/');
  const outSubdir = join(OUT_DIR, relDir);
  await ensureDir(outSubdir);

  const srcBuf = await readFile(srcPath);
  const srcBytes = srcBuf.byteLength;

  // Content fingerprint — the skip decision is by SOURCE BYTES, not by
  // output filename existence. Replacing a master under the same name
  // changes the hash and forces a full re-cut of every sibling; the old
  // name-only check silently served stale AVIF/WebP forever (bit us on
  // the dm-movies storyboards).
  const hash = createHash('md5').update(srcBuf).digest('hex');
  const prev = manifest[stemKey];
  // Migration: entries written before hashing existed carry no `h`. Adopt
  // the current source as the truth WITHOUT re-encoding (outputs were
  // produced from some version of it and re-cutting 7k files on a flag-day
  // would churn R2 for nothing). From then on the hash governs.
  const legacyAdopt = !!prev && prev.h === undefined;
  const unchanged = !!prev && (legacyAdopt || prev.h === hash);

  // ── Fast path: source unchanged → verify outputs, fill gaps only ──────
  if (unchanged && !FORCE) {
    const nativeW = prev.n;
    const primaryExt = prev.p;
    const rungs = LADDER.filter((w) => w < nativeW);
    const expected = [
      ...[primaryExt, 'webp', 'avif'].map((fe) => ({ out: join(outSubdir, `${stem}.${fe}`), fe, w: null })),
      ...rungs.flatMap((w) =>
        [primaryExt, 'webp', 'avif'].map((fe) => ({ out: join(outSubdir, `${stem}-${w}.${fe}`), fe, w })),
      ),
    ];
    let createdBytes = 0;
    let created = 0;
    let skipped = 0;
    if (expected.every(({ out }) => existsSync(out))) {
      // All present — no decode, no encode. The common case for every
      // file that didn't change since the last run.
      skipped = expected.length;
    } else {
      for (const { out, fe, w } of expected) {
        const kind = fe === 'webp' || fe === 'avif' ? fe : 'primary';
        const r = await emit(srcBuf, out, kind, primaryExt, w);
        createdBytes += r.bytes;
        r.skipped ? skipped++ : created++;
      }
    }
    return { rel, stemKey, srcBytes, nativeW, primaryExt, rungs, createdBytes, created, skipped, hash, recut: false, removedOld: 0 };
  }

  // ── Changed (or new / --force) source ─────────────────────────────────
  // A changed source first DELETES all old siblings: a smaller re-cut
  // would otherwise leave orphaned larger rungs from the previous
  // generation sitting next to the new files (mixed-generation srcsets).
  let removedOld = 0;
  const recut = !!prev && !unchanged;
  if (recut) removedOld = await deleteSiblings(stem, outSubdir);

  // Probe metadata: honour PNG alpha for the primary format, and read the
  // ORIENTED width (EXIF rotation swaps w/h) so rung filtering matches the
  // `.rotate()`-applied output dimensions.
  const meta = await sharp(srcBuf).metadata();
  const hasAlpha = meta.hasAlpha === true;
  const rotated = typeof meta.orientation === 'number' && meta.orientation >= 5;
  const nativeW = (rotated ? meta.height : meta.width) || 0;
  const primaryExt = JPG_EXTS.has(ext) || !hasAlpha ? 'jpg' : 'png';

  let createdBytes = 0;
  let created = 0;
  let skipped = 0;

  // --- native (un-suffixed, full resolution) -----------------------------
  for (const [k, fileExt] of [
    ['primary', primaryExt],
    ['webp', 'webp'],
    ['avif', 'avif'],
  ]) {
    const out = join(outSubdir, `${stem}.${fileExt}`);
    const r = await emit(srcBuf, out, k === 'primary' ? 'primary' : k, primaryExt, null, recut);
    createdBytes += r.bytes;
    r.skipped ? skipped++ : created++;
  }

  // --- width-ladder rungs (strictly smaller than native) -----------------
  const rungs = LADDER.filter((w) => w < nativeW);
  for (const w of rungs) {
    for (const [k, fileExt] of [
      ['primary', primaryExt],
      ['webp', 'webp'],
      ['avif', 'avif'],
    ]) {
      const out = join(outSubdir, `${stem}-${w}.${fileExt}`);
      const r = await emit(srcBuf, out, k === 'primary' ? 'primary' : k, primaryExt, w, recut);
      createdBytes += r.bytes;
      r.skipped ? skipped++ : created++;
    }
  }

  return {
    rel,
    stemKey,
    srcBytes,
    nativeW,
    primaryExt,
    rungs,
    createdBytes,
    created,
    skipped,
    hash,
    recut,
    removedOld,
  };
}

/** Bounded-concurrency pool: run `worker` over `items`, max N at a time. */
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Source directory missing: ${SRC_DIR}`);
    process.exit(1);
  }
  if (DRY) console.log('[dry-run] no files will be written.');
  if (FORCE) console.log('[force] re-encoding all outputs.');
  if (ONLY) console.log(`[scope] processing only public/projects/${ONLY}/`);
  console.log(`[concurrency] ${CONCURRENCY}`);
  console.log(`[ladder] ${LADDER.join(', ')} (rungs < native width)`);
  await ensureDir(OUT_DIR);

  const walkRoot = ONLY ? join(SRC_DIR, ONLY) : SRC_DIR;
  if (ONLY && !existsSync(walkRoot)) {
    console.error(`Source directory missing: ${walkRoot}`);
    process.exit(1);
  }

  // Gather all source paths first so the pool can fan out.
  const paths = [];
  for await (const p of walk(walkRoot)) {
    if (SRC_EXTS.has(extname(p).toLowerCase())) paths.push(p);
  }

  let count = 0;
  let srcTotal = 0;
  let createdBytesTotal = 0;
  let createdTotal = 0;
  let skippedTotal = 0;
  let recutTotal = 0;
  const failures = [];
  const manifest = await loadManifest();

  const results = await runPool(
    paths,
    async (srcPath) => {
      // Per-file isolation: one corrupt/truncated source must not abort
      // the whole run (and previously also discarded the manifest merge
      // for every file that HAD succeeded).
      let r;
      try {
        r = await processOne(srcPath, manifest);
      } catch (err) {
        failures.push({ rel: relative(SRC_DIR, srcPath), msg: err.message });
        process.stdout.write(`! ${relative(SRC_DIR, srcPath)}  FAILED: ${err.message}\n`);
        return null;
      }
      if (r) {
        const recutNote = r.recut ? `  ↻ re-cut (${r.removedOld} old siblings removed)` : '';
        process.stdout.write(
          `· ${r.rel}  ${r.nativeW}px  +${r.created} new${r.skipped ? ` (${r.skipped} skipped)` : ''}  ${fmt(r.createdBytes)}${recutNote}\n`,
        );
      }
      return r;
    },
    CONCURRENCY,
  );

  for (const r of results) {
    if (!r) continue;
    count += 1;
    srcTotal += r.srcBytes;
    createdBytesTotal += r.createdBytes;
    createdTotal += r.created;
    skippedTotal += r.skipped;
    if (r.recut) recutTotal += 1;
    // Merge into manifest: native width, rung widths, primary fallback
    // ext, source content hash (the skip/re-cut decision for next run).
    manifest[r.stemKey] = { n: r.nativeW, r: r.rungs, p: r.primaryExt, h: r.hash };
  }

  // Write the manifest (sorted keys for stable diffs).
  if (!DRY) {
    const sorted = {};
    for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k];
    await ensureDir(dirname(MANIFEST_PATH));
    await writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 0) + '\n');
  }

  console.log('\n────────── SUMMARY ──────────');
  console.log(`images processed: ${count}`);
  console.log(`source total:     ${fmt(srcTotal)}`);
  console.log(`new files:        ${createdTotal}  (${fmt(createdBytesTotal)})`);
  console.log(`skipped (up-to-date): ${skippedTotal}`);
  if (recutTotal) console.log(`re-cut sources:   ${recutTotal} (changed bytes under a kept filename)`);
  if (failures.length) {
    console.log(`FAILED:           ${failures.length}`);
    for (const f of failures) console.log(`  ! ${f.rel} — ${f.msg}`);
  }
  console.log(`manifest:         ${relative(ROOT, MANIFEST_PATH)}  (${Object.keys(manifest).length} entries)`);
  console.log(`output folder:    public/projects-opt/`);
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
