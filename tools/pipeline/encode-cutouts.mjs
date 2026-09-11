#!/usr/bin/env node
/**
 * encode-cutouts.mjs — alpha-preserving two-tier WebP for cut-out artwork.
 *
 *   npm run media:cutouts -- <slug> "<source dir>"
 *   npm run media:cutouts -- <slug> "<source dir>" --append
 *   npm run media:cutouts -- <slug> "<source dir>" --only-tier=zoom --start=17
 *
 * For artwork that is a CUT-OUT — ink on a transparent ground — where alpha is
 * the whole point, so JPEG is out and the generic masters pipeline is wrong
 * (process-masters.mjs copies PNG/WebP byte-for-byte; it does not resize, and a
 * 141 MB print folder cannot go to the web as-is).
 *
 * Emits, into public/projects/<slug>/, for every PNG in the source (sorted):
 *
 *   NN.webp         long edge 768   the drifting / thumbnail tier
 *   NN.large.webp   long edge 1536  swapped in on focus, loaded one at a time
 *   NN.zoom.webp    long edge 3072  swapped in when a focused piece is zoomed
 *                                   past ~1.5× — line-work needs the pixels
 *
 * Both tiers sit flat in the folder because the media manifest scans only the
 * `compare/` subfolder; anything else would be skipped, never synced, never
 * verified. A component tells the tiers apart by the `.large.` suffix.
 *
 * Measured 2026-09-11 on the Reveries series (16 pieces, soft airbrushed
 * alpha): base tier ~3.3 MB for all 16; large tier 300–600 KB each. The soft
 * alpha edges are what cost — the ink itself compresses to almost nothing —
 * so `alphaQuality` is the lever, set lower on the large tier where the piece
 * is viewed alone and a little edge softness is invisible.
 *
 * NEVER overwrites. If the target folder already has files this exits 1 and
 * names them (rules R2/R3). Version up the slug or clear the folder yourself.
 * `--append` is the one sanctioned way to grow a series: numbering continues
 * from the highest NN already there, and every output path is still checked
 * for existence before it is written. `--only-tier=<name>` writes just that
 * tier (for adding a tier to an existing series) and `--start=<n>` sets the
 * first number, so the new files line up with the ones already there; files
 * that exist are skipped, never overwritten.
 *
 * Sources: .png (alpha expected) plus .jpg/.jpeg for scanned drawings — those
 * have no alpha and encode as opaque WebP, which is correct for a scan.
 */
import { readdir, mkdir, stat, access } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const ALL_TIERS = [
  { name: 'base',  suffix: '',        long: 768,  quality: 80, alphaQuality: 80 },
  { name: 'large', suffix: '.large',  long: 1536, quality: 80, alphaQuality: 60 },
  { name: 'zoom',  suffix: '.zoom',   long: 3072, quality: 78, alphaQuality: 50 },
];

const args = process.argv.slice(2);
const APPEND = args.includes('--append');
const ONLY = (args.find((a) => a.startsWith('--only-tier=')) || '').split('=')[1] || null;
const START = Number((args.find((a) => a.startsWith('--start=')) || '').split('=')[1] || 0);
const [slug, srcDir] = args.filter((a) => !a.startsWith('--'));
const TIERS = ONLY ? ALL_TIERS.filter((t) => t.name === ONLY) : ALL_TIERS;
if (ONLY && !TIERS.length) {
  console.error(`[cutouts] unknown tier "${ONLY}" — one of ${ALL_TIERS.map((t) => t.name).join(', ')}`);
  process.exit(2);
}
if (!slug || !srcDir) {
  console.error('usage: encode-cutouts.mjs <slug> "<source dir of PNGs>"');
  process.exit(2);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`[cutouts] bad slug "${slug}" — lowercase letters, digits, hyphens only`);
  process.exit(2);
}

const outDir = join(ROOT, 'public', 'projects', slug);

// Refuse to clobber. A previous run, a hand-dropped file, anything — unless
// --append, in which case numbering continues after what is there.
let startAt = START > 0 ? START - 1 : 0;
try {
  const existing = (await readdir(outDir)).filter((f) => !f.startsWith('.'));
  if (existing.length && ONLY) {
    console.log(`[cutouts] --only-tier=${ONLY}: writing that tier only, from ${String(startAt + 1).padStart(2, '0')}; existing files are skipped`);
  } else if (existing.length && APPEND) {
    startAt = Math.max(0, ...existing.map((f) => Number((f.match(/^(\d+)\./) || [])[1] || 0)));
    console.log(`[cutouts] --append: ${existing.length} file(s) present, numbering continues from ${String(startAt + 1).padStart(2, '0')}`);
  } else if (existing.length) {
    console.error(`[cutouts] ${outDir} already holds ${existing.length} file(s) — refusing to overwrite:`);
    existing.slice(0, 8).forEach((f) => console.error(`  - ${f}`));
    console.error('[cutouts] Version the slug up or clear the folder yourself (R3).');
    process.exit(1);
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

const sources = (await readdir(srcDir))
  .filter((f) => /^\.(png|jpe?g)$/i.test(extname(f)) && !f.startsWith('.'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!sources.length) {
  console.error(`[cutouts] no .png files in ${srcDir}`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
console.log(`[cutouts] ${sources.length} source PNG(s) → ${outDir}\n`);

const pad = Math.max(2, String(startAt + sources.length).length);
let total = 0;
const rows = [];

for (let i = 0; i < sources.length; i += 1) {
  const src = join(srcDir, sources[i]);
  const nn = String(startAt + i + 1).padStart(pad, '0');
  const meta = await sharp(src).metadata();
  if (!meta.hasAlpha && extname(src).toLowerCase() === '.png') {
    // A PNG without alpha is probably an export mistake; a JPEG is a scan.
    console.warn(`  ! ${sources[i]} has no alpha channel — encoding as an opaque plate`);
  }
  const portrait = meta.height >= meta.width;
  const row = { nn, src: basename(src), dims: `${meta.width}x${meta.height}` };

  for (const t of TIERS) {
    const out = join(outDir, `${nn}${t.suffix}.webp`);
    // Never write over a file. With --only-tier an existing file is simply
    // skipped (the run is idempotent); otherwise it is an abort.
    let exists = false;
    try { await access(out); exists = true; } catch { /* absent, good */ }
    if (exists) {
      if (ONLY) { const { size } = await stat(out); total += size; row[t.suffix || 'base'] = size; row.skipped = true; continue; }
      console.error(`[cutouts] ${out} appeared mid-run — aborting`); process.exit(1);
    }

    // Long edge only — the other side follows the aspect. One options object:
    // sharp's resize(a, b) reads `b` as a height, not as options.
    await sharp(src)
      .resize({ ...(portrait ? { height: t.long } : { width: t.long }), withoutEnlargement: true })
      .webp({ quality: t.quality, alphaQuality: t.alphaQuality, effort: 6 })
      .toFile(out);

    const { size } = await stat(out);
    total += size;
    row[t.suffix || 'base'] = size;
  }
  rows.push(row);
  const kb = (n) => (n == null ? '   —  ' : `${(n / 1024).toFixed(0).padStart(4)} KB`);
  console.log(`  ${nn}  ${row.dims.padEnd(10)}  ${TIERS.map((t) => `${t.name} ${kb(row[t.suffix || 'base'])}`).join('   ')}${row.skipped ? '  (existed)' : ''}   ← ${row.src}`);
}

for (const t of TIERS) {
  const sum = rows.reduce((s, r) => s + (r[t.suffix || 'base'] || 0), 0);
  console.log(`[cutouts] ${t.name.padEnd(5)} tier ${(sum / 1048576).toFixed(2)} MB`);
}
console.log(`[cutouts] ${rows.length * TIERS.length} files, ${(total / 1048576).toFixed(2)} MB total`);
console.log('\n[cutouts] next:  npm run media:manifest && npm run media:sync && npm run media:verify');
