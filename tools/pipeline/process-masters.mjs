#!/usr/bin/env node
/**
 * process-masters.mjs — single-command master pipeline.
 *
 * Walks `~/media-masters/<slug>/` and produces delivery-ready files:
 *
 *   - Images (.jpg/.jpeg/.png) -> public/projects/<slug>/<file>
 *     plus (Phase B, opt-in via IMAGE_LADDER=1) an AVIF/WebP ladder.
 *   - Videos (.mov/.mp4/.webm/.m4v) -> public/projects/<slug>/<file>.mp4
 *     via tools/pipeline/encode-video.mjs at the preset the FILENAME selects,
 *     with a keyframe forced at every detected scene cut.
 *   - R2 sync is Phase C and is NOT wired yet.
 *
 * Naming convention drives video preset selection:
 *
 *   foo.mov            -> showcase preset (controls + audio)
 *   foo.loop.mov       -> loop preset (autoplay + loop + muted, no audio)
 *   foo.loop-audio.mov -> loop-audio preset (muted autoplay loop that KEEPS
 *                         its AAC track for an unmute toggle)
 *   foo.hero-2k.mov    -> hero-2k preset (1440p, flagship tier)
 *   foo.alpha-loop.mov -> alpha-loop preset (HEVC+VP9 transparent loop)
 *
 * Incremental by default: a master whose delivery files (mp4 + poster /
 * copied image) are all NEWER than the master is skipped. `--force`
 * re-processes everything.
 *
 * The intent suffix is stripped from the output filename so the CMS
 * path stays short (foo.loop.mov -> foo.mp4).
 *
 * (* TIF and PSD aren't natively decoded by sharp; the optimizer
 *    falls back to an empty pass. Convert those upstream in your
 *    DCC of choice — final delivery wants a flat raster anyway.)
 *
 * Usage:
 *   node tools/pipeline/process-masters.mjs                       # all slugs
 *   node tools/pipeline/process-masters.mjs season-one                  # one slug
 *   node tools/pipeline/process-masters.mjs season-one league-ident             # several
 *   node tools/pipeline/process-masters.mjs --sync-r2 season-one        # also push to R2
 *   node tools/pipeline/process-masters.mjs --dry-run season-one        # preview only
 *
 * Once-only setup:
 *   1. Create the masters root: `mkdir -p ~/media-masters`
 *   2. Drop slug-named subfolders inside (season-one/, league-ident/, etc.).
 *   3. ffmpeg + ffprobe are on PATH at ~/.local/bin (no Homebrew on this machine).
 *   4. R2 sync (Phase C) will require a gitignored `.env.local`. Not yet used.
 */
import { spawn } from 'node:child_process';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// Two levels up: this file lives at <repo>/tools/pipeline/. It was <repo>/scripts/
// upstream, where a single '..' was right. Getting this wrong makes every output
// path land under tools/ instead of the repo root.
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_MASTERS_ROOT = join(homedir(), 'media-masters');
const MASTERS_ROOT = process.env.MASTERS_ROOT || DEFAULT_MASTERS_ROOT;

// Delivery outputs go to public/projects/, which Vite copies verbatim into dist/
// under a stable path. src/lib/mediaManifest.js turns them into URLs; nothing
// scans this directory at build time. Overridable so Phase C can point it at a
// gitignored build dir once R2 becomes the delivery layer.
const PUBLIC_PROJECTS = process.env.DELIVERY_ROOT || join(ROOT, 'public', 'projects');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png']);
const PASS_THROUGH_EXTS = new Set(['.gif', '.svg', '.webp', '.avif']); // copied as-is, not optimized
const VIDEO_EXTS = new Set(['.mov', '.mp4', '.m4v', '.webm']);
// Order matters: longer suffixes must be checked first so `.alpha-loop`
// wins over `.loop` (the latter is a substring suffix of the former).
// `.loop-audio` was missing here for a stretch — a foo.loop-audio.mov fell
// through to showcase AND kept the suffix in its delivery filename.
const PRESET_SUFFIXES = ['.alpha-loop', '.loop-audio', '.hero-2k', '.showcase', '.loop'];

function parseArgs(argv) {
  const out = { slugs: [], syncR2: false, dryRun: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sync-r2') out.syncR2 = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--force') out.force = true;
    else if (a === '--help' || a === '-h') { out.help = true; }
    else out.slugs.push(a);
  }
  return out;
}

/** True when every delivery artefact exists and is newer than the master —
 *  i.e. nothing to do for this file unless --force. */
function upToDate(masterPath, outputs) {
  const masterMtime = statSync(masterPath).mtimeMs;
  return outputs.every((p) => existsSync(p) && statSync(p).mtimeMs > masterMtime);
}

function help() {
  console.log(`process-masters.mjs — single-command master pipeline.

Usage:
  node tools/pipeline/process-masters.mjs [--sync-r2] [--dry-run] [<slug> ...]

Walks $MASTERS_ROOT/<slug>/ and produces public/projects/<slug>/* delivery
files (images via sharp + sibling optimizer, videos via ffmpeg).

  --sync-r2     NOT WIRED YET (Phase C). sync-to-store.mjs is still in the vault.
  --dry-run     preview only, no writes
  --force       re-process masters even when delivery files are up to date
  <slug> ...    process specific slug folders (default: all)

Masters root: ${MASTERS_ROOT}
(override via MASTERS_ROOT env var)

Naming convention for videos:
  foo.mov          -> showcase preset (default)
  foo.loop.mov     -> loop preset (autoplay+loop+muted, no audio)
  foo.hero-2k.mov  -> hero-2k preset (1440p flagship)

The suffix is stripped from the output filename (foo.loop.mov -> foo.mp4).
Images don't carry suffixes; they are copied through as-is for now.
`);
}

function detectVideoPreset(filename) {
  const stem = basename(filename, extname(filename));
  for (const suffix of PRESET_SUFFIXES) {
    if (stem.endsWith(suffix)) {
      return { preset: suffix.slice(1), cleanStem: stem.slice(0, -suffix.length) };
    }
  }
  // A dotted tail that is not a known preset is almost always a typo
  // (`.loop-audi`) or an intent nobody wired up. Surface it instead of
  // silently blending into showcase output (audit 2026-07-11).
  const tail = stem.includes('.') ? stem.slice(stem.lastIndexOf('.')) : '';
  if (tail && tail.length <= 16) {
    console.warn(`  [warn] unrecognised suffix "${tail}" on ${filename} — defaulting to showcase (known: ${PRESET_SUFFIXES.join(' ')})`);
  }
  return { preset: 'showcase', cleanStem: stem };
}

function runScript(scriptPath, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const allArgs = [scriptPath, ...args];
    if (opts.dotenv) allArgs.unshift(`--env-file=${opts.dotenv}`);
    const child = spawn('node', allArgs, {
      stdio: opts.stdio ?? 'inherit',
      cwd: ROOT,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function discoverSlugs() {
  if (!existsSync(MASTERS_ROOT)) return [];
  return readdir(MASTERS_ROOT, { withFileTypes: true }).then((entries) =>
    entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
      .map((e) => e.name),
  );
}

async function processSlug(slug, args) {
  const masterDir = join(MASTERS_ROOT, slug);
  const outDir = join(PUBLIC_PROJECTS, slug);
  if (!existsSync(masterDir)) {
    console.warn(`  [skip] no master folder for slug "${slug}" at ${masterDir}`);
    return { slug, processed: 0, errors: 0 };
  }
  if (!args.dryRun && !existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  const entries = await readdir(masterDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.')).map((e) => e.name);

  let processed = 0;
  let errors = 0;

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const inPath = join(masterDir, file);

    if (IMAGE_EXTS.has(ext) || PASS_THROUGH_EXTS.has(ext)) {
      // Image / pass-through masters land directly in
      // public/projects/<slug>/<file>. The optimize-images.mjs pass at the
      // end emits siblings into public/projects-opt/<slug>/ (content-hash
      // aware, so the copy here is the only thing the mtime skip saves).
      const outPath = join(outDir, file);
      const tag = IMAGE_EXTS.has(ext) ? '[image]' : '[pass] ';
      if (!args.force && upToDate(inPath, [outPath])) {
        console.log(`  [skip]  ${file} (delivery copy up to date)`);
        processed += 1;
      } else {
        console.log(`  ${tag} ${file} -> public/projects/${slug}/${file}`);
        if (!args.dryRun) {
          // Copy via Node fs (fastest cross-platform; no need for sharp here).
          const srcBuf = await import('node:fs/promises').then((m) => m.readFile(inPath));
          await import('node:fs/promises').then((m) => m.writeFile(outPath, srcBuf));
        }
        processed += 1;
      }
    } else if (VIDEO_EXTS.has(ext)) {
      const { preset, cleanStem } = detectVideoPreset(file);
      const outPath = join(outDir, `${cleanStem}.mp4`);
      // Incremental: skip when the encoded mp4 AND its poster are both
      // newer than the master. Adding one new clip to a 12-video project
      // previously re-encoded all 12 (tens of minutes) and regenerated
      // every poster, clobbering hand-picked ones. A poster newer than
      // the master also counts as up to date (that's the hand-pick case).
      // alpha-loop emits no mp4-only artefact pair we can cheaply infer
      // (hevc .mp4 + .webm) — check the primary .mp4 + poster, which the
      // preset always produces (skipPoster presets check the mp4 only).
      const posterPath = join(outDir, `${cleanStem}-poster.jpg`);
      const expectedOutputs = preset === 'alpha-loop' ? [outPath] : [outPath, posterPath];
      if (!args.force && upToDate(inPath, expectedOutputs)) {
        console.log(`  [skip]  ${file} (encode + poster up to date; --force to re-encode)`);
        processed += 1;
        continue;
      }
      console.log(`  [video] ${file} -> public/projects/${slug}/${cleanStem}.mp4  (preset=${preset})`);
      try {
        const encArgs = ['tools/pipeline/encode-video.mjs', '--preset', preset, inPath, outPath];
        if (args.dryRun) encArgs.push('--dry-run');
        await runScript('tools/pipeline/encode-video.mjs', encArgs.slice(1), {});
        processed += 1;
      } catch (err) {
        console.error(`  [error] encode failed for ${file}: ${err.message}`);
        errors += 1;
      }
    } else {
      console.log(`  [skip]  ${file} (unrecognized extension ${ext})`);
    }
  }

  // Image ladder: OFF by default here (2026-08-09, Phase A).
  //
  // optimize-images.mjs emits an AVIF/WebP/JPG width ladder into a
  // projects-opt/ tree. Only a renderer that emits <picture> with srcset can
  // use it — and src/lib/images.js currently returns ONE url per file from a
  // Vite glob, so every one of those siblings would be generated, committed or
  // synced, and never requested. Generating output nothing consumes is how a
  // pipeline earns distrust.
  //
  // Turn it on in Phase B, together with the manifest + srcset work, via:
  //   IMAGE_LADDER=1 node tools/pipeline/process-masters.mjs <slug>
  if (processed > 0 && process.env.IMAGE_LADDER === '1') {
    console.log(`\n  [optimize] running optimize-images.mjs --only=${slug}`);
    try {
      const optArgs = ['--only=' + slug];
      if (args.dryRun) optArgs.push('--dry-run');
      await runScript('tools/pipeline/optimize-images.mjs', optArgs, {});
    } catch (err) {
      console.error(`  [error] optimize-images failed: ${err.message}`);
      errors += 1;
    }
  } else if (processed > 0) {
    console.log(`\n  [optimize] skipped — the site has no srcset renderer yet (set IMAGE_LADDER=1 to force)`);
  }

  return { slug, processed, errors };
}

async function maybeSyncR2(slugs, args) {
  if (!args.syncR2 || args.dryRun) return;
  // Sync produced delivery files (master images + encoded videos) AND
  // their optimized siblings. The sync script is idempotent so we
  // can pass the whole tree without checking what changed.
  const paths = [];
  for (const slug of slugs) {
    const projDir = join(PUBLIC_PROJECTS, slug);
    if (existsSync(projDir)) paths.push(projDir);
    const optDir = join(ROOT, 'public', 'projects-opt', slug);
    if (existsSync(optDir)) paths.push(optDir);
  }
  if (paths.length === 0) return;
  console.log(`\n[sync-r2] uploading ${paths.length} path(s) to Cloudflare R2`);
  // main() fail-fasts on a missing .env.local before any encoding starts,
  // so reaching here without credentials shouldn't happen — bail cleanly
  // if it somehow does instead of letting node crash on --env-file.
  const dotenv = join(ROOT, '.env.local');
  if (!existsSync(dotenv)) {
    console.error(`[sync-r2] skipped: ${dotenv} not found (R2 credentials live there).`);
    return;
  }
  await runScript('scripts/sync-to-store.mjs', paths, { dotenv });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    help();
    return;
  }

  if (!existsSync(MASTERS_ROOT)) {
    console.error(`Masters root does not exist: ${MASTERS_ROOT}`);
    console.error(`Create it with: mkdir -p "${MASTERS_ROOT}"`);
    console.error(`Or set MASTERS_ROOT env var to a different path.`);
    process.exit(1);
  }

  // Fail fast on missing credentials BEFORE a potentially hours-long
  // encode pass — previously this only warned, then node crashed on the
  // missing --env-file at the very end of the run.
  if (args.syncR2 && !args.dryRun && !existsSync(join(ROOT, '.env.local'))) {
    console.error(`--sync-r2 requires .env.local (R2 credentials) at ${join(ROOT, '.env.local')}.`);
    console.error(`Run without --sync-r2, or create .env.local first (keys documented in CLAUDE.md).`);
    process.exit(1);
  }

  const allSlugs = await discoverSlugs();
  const slugs = args.slugs.length > 0 ? args.slugs : allSlugs;

  if (slugs.length === 0) {
    console.log(`No slug folders found under ${MASTERS_ROOT}.`);
    return;
  }

  console.log(`[process-masters] ${args.dryRun ? '[dry-run] ' : ''}processing ${slugs.length} slug(s):  ${slugs.join(', ')}`);
  console.log(`[process-masters] masters root: ${MASTERS_ROOT}`);
  console.log('');

  const results = [];
  for (const slug of slugs) {
    console.log(`\n[slug] ${slug}`);
    const r = await processSlug(slug, args);
    results.push(r);
  }

  // Refresh the committed webm-sibling manifest from the (possibly newly
  // encoded) working tree, so the renderer only emits <source webm> for
  // .mp4s that truly have a .webm sibling. Cheap + idempotent; the manifest
  // is git-tracked because the media-less Pages build can't check disk.
  //
  // SKIP_WEBM_MANIFEST guard (for CI): build-webm-manifest REBUILDS the
  // manifest from scratch by scanning public/projects/**. On a media-less CI
  // runner that tree holds only the files just encoded, so a rebuild would
  // write a near-empty manifest and WIPE every existing alpha-loop .webm
  // entry site-wide. The CI pipeline never produces .webm (alpha-loop needs
  // Apple's hevc_videotoolbox, macOS-only) so it must never touch this
  // manifest — it sets SKIP_WEBM_MANIFEST=1. The laptop, which has the full
  // media tree, owns this file. (If alpha-loop is ever enabled in CI, this
  // builder must gain merge-not-rebuild semantics before the skip is lifted.)
  // PHASE A (2026-08-09): both manifest builders are DISABLED, not merely
  // guarded. They live in the vault at
  // studio-systems-pack/04-media-pipeline/scripts/ and are not copied into this
  // repo yet, because nothing here reads a manifest — src/lib/images.js still
  // globs the disk. Calling them produced MODULE_NOT_FOUND and a warning on
  // every run, which is the kind of routine red text people learn to ignore.
  //
  // They come back in Phase B, together with the images.js rewrite, and BOTH
  // rebuild-from-scan — so the SKIP_WEBM_MANIFEST guard below must be honoured
  // by CI from the moment they return, or a media-less runner wipes the lot.
  const MANIFESTS_ENABLED = process.env.MEDIA_MANIFESTS === '1';

  if (!args.dryRun && MANIFESTS_ENABLED && !process.env.SKIP_WEBM_MANIFEST) {
    try {
      await runScript('tools/pipeline/build-webm-manifest.mjs', [], {});
    } catch (err) {
      console.error(`  [warn] webm-manifest refresh failed: ${err.message}`);
    }
    // Mobile-video manifest (.720p.mp4 siblings) — same rebuild-from-scan
    // semantics, so it shares the CI guard: a media-less runner rebuild
    // would wipe existing entries site-wide. CI DOES encode 720p siblings,
    // but a new entry simply waits for the next laptop run — the renderer
    // omits the mobile <source> until the manifest knows it exists.
    try {
      await runScript('tools/pipeline/build-mobile-video-manifest.mjs', [], {});
    } catch (err) {
      console.error(`  [warn] mobile-video-manifest refresh failed: ${err.message}`);
    }
  } else if (process.env.SKIP_WEBM_MANIFEST) {
    console.log('  [skip] webm + mobile-video manifest refresh (SKIP_WEBM_MANIFEST set — media-less runner must not rebuild them)');
  } else if (!args.dryRun && !MANIFESTS_ENABLED) {
    console.log('  [skip] webm/mobile sibling manifests — not wired yet (set MEDIA_MANIFESTS=1 once they are)');
  }

  // The MEDIA MANIFEST is different from those two, and it is not optional:
  // src/lib/mediaManifest.js is the only thing that knows what media exists, so
  // encoding a file without refreshing it means the build cannot see the file.
  // Skipped in CI for the rebuild reason documented at the top of this file.
  if (!args.dryRun && !process.env.SKIP_REBUILD_MANIFESTS) {
    try {
      await runScript('tools/pipeline/build-media-manifest.mjs', [], {});
    } catch (err) {
      console.error(`  [error] media manifest refresh FAILED: ${err.message}`);
      console.error('  [error] the new media will be invisible to the build until you run: npm run media:manifest');
      errors += 1;
    }
  } else if (process.env.SKIP_REBUILD_MANIFESTS) {
    console.log('  [skip] media manifest refresh (SKIP_REBUILD_MANIFESTS — this runner must not rebuild it)');
  }

  const totalErrors = results.reduce((n, r) => n + r.errors, 0);

  // Never push a batch that had failures: the failed file's previous-
  // generation output may still be on disk under the same name, and the
  // idempotent sync would happily ship it as if it were current.
  if (!args.dryRun) {
    if (totalErrors > 0 && args.syncR2) {
      console.error(`\n[sync-r2] SKIPPED: ${totalErrors} error(s) above — fix and re-run before pushing to R2.`);
    } else {
      await maybeSyncR2(slugs, args);
    }
  }

  console.log('\n────────── SUMMARY ──────────');
  for (const r of results) {
    const status = r.errors > 0 ? `${r.processed} ok, ${r.errors} ERRORS` : `${r.processed} processed`;
    console.log(`  ${r.slug.padEnd(20)} ${status}`);
  }
  console.log('');
  if (!args.syncR2 && !args.dryRun && totalErrors === 0) {
    console.log(`[next] regenerate the manifest so the build can see the new files:`);
    console.log(`         npm run media:manifest`);
    console.log(`[next] R2 sync is NOT wired yet — that is Phase C. See ~/.claude/plans/joyful-sparking-pebble.md`);
    console.log(`[next] or rerun with --sync-r2 to do it automatically.`);
  }
  // Honest exit code: a batch with failed encodes/optimizes must not
  // report success to the shell (or to any orchestrator wrapping this).
  if (totalErrors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Suppress unused-var lint — kept for future use (path computations).
void relative;
void statSync;
