#!/usr/bin/env node
/**
 * Sync local files to the Cloudflare R2 bucket fronting cdn.studio.design.
 *
 * Run as:
 *   node --env-file=.env.local scripts/sync-to-store.mjs [--prune] [--force-headers] <path>...
 *
 * Examples:
 *   # Single file
 *   node --env-file=.env.local scripts/sync-to-store.mjs public/bg-desktop.mp4
 *
 *   # A whole tree
 *   node --env-file=.env.local scripts/sync-to-store.mjs public/projects-opt
 *
 *   # Multiple
 *   node --env-file=.env.local scripts/sync-to-store.mjs \
 *     public/bg-desktop.mp4 public/projects-opt
 *
 *   # Sync a project AND delete R2 orphans under its prefix
 *   # (useful after renaming/removing legacy hashed files locally).
 *   node --env-file=.env.local scripts/sync-to-store.mjs --prune \
 *     public/projects/league-ident public/projects-opt/league-ident
 *
 * Path → key mapping:
 *   Local paths under `public/` map to R2 keys with the `public/` prefix
 *   stripped — e.g. `public/projects-opt/foo.avif` → `projects-opt/foo.avif`.
 *   This matches the URL the site uses (`/projects-opt/foo.avif` → resolves
 *   to `https://cdn.studio.design/projects-opt/foo.avif`).
 *
 * Idempotency:
 *   For each local file, we do a HeadObject and compare the remote ETag
 *   against the local MD5 hex digest. R2 (S3-compatible) returns ETag as
 *   the MD5 for objects uploaded in a single PUT (anything we send via
 *   PutObject under ~5 MB by default). For bigger files, the SDK falls
 *   back to multipart upload and the ETag becomes a non-MD5 token; in
 *   that case we recompute the local "multipart ETag" the same way S3
 *   does (per-part MD5s concatenated, MD5d, then `-N` suffix where N is
 *   the part count). This keeps re-runs cheap — only changed files
 *   re-upload, regardless of size.
 *
 * Concurrency:
 *   Up to 6 files in flight simultaneously. R2 free tier is generous
 *   (1M Class A ops/month) but we don't need to blast it.
 */

import { createReadStream, statSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// ─── Config ──────────────────────────────────────────────────────
const {
  R2_ACCOUNT_ID,
  R2_BUCKET,
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
} = process.env;

for (const [k, v] of Object.entries({
  R2_ACCOUNT_ID, R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
})) {
  if (!v) {
    console.error(`Missing env var: ${k}. Did you pass --env-file=.env.local?`);
    process.exit(1);
  }
}

const CONCURRENCY = 6;
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 MiB — matches S3 default

// Extension → Content-Type. Small map; we control the inputs.
const MIME = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.woff2':'font/woff2',
  '.json': 'application/json',
  '.txt':  'text/plain; charset=utf-8',
};

// Cache policy tiers, applied per-file:
//
//  · Content-hashed filenames → 1 year immutable. The stem must be one
//    unbroken 22+ char base64-ish run (underscores ok), with at most a
//    trailing `-NNN` width-rung suffix from the optimizer. Hyphens are
//    otherwise DISALLOWED: long human kebab-case names (e.g.
//    `gfx-champions-trophy-poster.jpg`) previously matched the old
//    `[A-Za-z0-9_-]{22,}` heuristic and shipped re-cuttable posters on a
//    1-year immutable policy — the exact stale-cache trap the project
//    tier exists to avoid. A genuinely hashed name that happens to carry
//    a hyphen now merely falls to the 30d/1d tiers, which costs a
//    revalidation, never correctness.
//
//  · Everything project-bound under `projects/*` or `projects-opt/*`
//    (videos, posters, optimizer outputs, master stills) → 30 days,
//    must-revalidate. Tied to a published project so it almost never
//    changes, but the filenames carry no content hash, so `immutable`
//    would mean a re-cut never reaches returning browsers until cache
//    eviction. 30d keeps edge hit rates near-immutable while letting a
//    re-encode land within a month.
//
//  · Everything else → 1 day, must-revalidate. Top-level mutables
//    (`bg-desktop.mp4`, etc.) live in active design iteration and need
//    a tight refresh window. Re-uploading the same name overwrites
//    within a day.
function cacheControlFor(localPath) {
  // Normalize to forward slashes so the tests work on macOS + Linux.
  const norm = localPath.split(/[\\/]/).join('/');
  const base = norm.split('/').pop().split('.')[0];

  const looksHashed = /^[A-Za-z0-9_]{22,}(-\d{2,4})?$/.test(base);
  if (looksHashed) return 'public, max-age=31536000, immutable';

  const isProjectMedia = /\/(projects|projects-opt)\//.test(norm);
  if (isProjectMedia) return 'public, max-age=2592000, must-revalidate'; // 30 days

  return 'public, max-age=86400, must-revalidate';
}

// ─── R2 client ──────────────────────────────────────────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ─── Helpers ────────────────────────────────────────────────────

// Walk a path: file → [self], dir → all files recursively.
function walk(p) {
  const abs = resolve(p);
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  if (!st.isDirectory()) return [];
  const out = [];
  for (const ent of readdirSync(abs, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue; // skip dotfiles
    const child = resolve(abs, ent.name);
    if (ent.isDirectory()) out.push(...walk(child));
    else if (ent.isFile()) out.push(child);
  }
  return out;
}

// `public/foo/bar.jpg` → `foo/bar.jpg` (R2 key)
function localToKey(absPath) {
  const rel = relative(resolve('public'), absPath);
  if (rel.startsWith('..')) {
    // Path is outside public/ — keep the path relative to repo root,
    // but warn since this is unusual.
    return relative(resolve('.'), absPath).split(/[\\/]/).join('/');
  }
  return rel.split(/[\\/]/).join('/');
}

// Multipart-aware ETag computation. For files <= threshold, this is
// the file's MD5. For larger files, it follows the S3 multipart spec.
async function localETag(absPath, partSize = MULTIPART_THRESHOLD) {
  const buf = await readFile(absPath);
  if (buf.length <= partSize) {
    return createHash('md5').update(buf).digest('hex');
  }
  // Multipart: hash each part, concatenate the digests, hash again,
  // append `-N`. S3 chooses part size based on uploader config, not
  // file size, so we mirror the SDK's default (MULTIPART_THRESHOLD).
  const parts = Math.ceil(buf.length / partSize);
  const concatenated = Buffer.alloc(parts * 16);
  for (let i = 0; i < parts; i++) {
    const slice = buf.subarray(i * partSize, (i + 1) * partSize);
    const md5 = createHash('md5').update(slice).digest();
    md5.copy(concatenated, i * 16);
  }
  const finalDigest = createHash('md5').update(concatenated).digest('hex');
  return `${finalDigest}-${parts}`;
}

async function remoteETag(key) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    // Strip surrounding quotes from ETag — S3 returns it quoted.
    return r.ETag ? r.ETag.replace(/^"|"$/g, '') : null;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return null;
    throw e;
  }
}

async function uploadOne(absPath, key) {
  const ext = extname(absPath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const cacheControl = cacheControlFor(absPath);
  const size = statSync(absPath).size;

  const params = {
    Bucket: R2_BUCKET,
    Key: key,
    Body: createReadStream(absPath),
    ContentType: contentType,
    CacheControl: cacheControl,
  };

  if (size <= MULTIPART_THRESHOLD) {
    // Small file — single PUT, ETag will equal MD5.
    await s3.send(new PutObjectCommand(params));
  } else {
    // Large file — use the lib-storage Upload helper which streams
    // and handles multipart automatically.
    const upload = new Upload({
      client: s3,
      params,
      partSize: MULTIPART_THRESHOLD,
      queueSize: 4,
    });
    await upload.done();
  }
}

// In-place metadata refresh — bytes stay on R2, only the headers
// (Cache-Control, Content-Type) get rewritten. Used by --force-headers
// to apply the current `cacheControlFor()` policy to objects that were
// uploaded under an older policy. Cheap: one CopyObject per file with
// `MetadataDirective: REPLACE`, no byte transfer.
async function refreshHeaders(absPath, key) {
  const ext = extname(absPath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const cacheControl = cacheControlFor(absPath);

  await s3.send(new CopyObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    // S3 CopySource expects "bucket/key" form, URL-encoded.
    CopySource: `${R2_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
    ContentType: contentType,
    CacheControl: cacheControl,
    MetadataDirective: 'REPLACE',
  }));
}

// ─── Main ───────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
// `--force-headers` re-applies the current cacheControlFor() policy to
// existing R2 objects without re-uploading bytes — useful after the
// policy changes (e.g. the 2026-05-06 30-day project-media tier). Uses
// CopyObject in-place; cheap and idempotent.
const FORCE_HEADERS = rawArgs.includes('--force-headers');
// `--prune` deletes R2 objects under each DIRECTORY arg's prefix that
// aren't present in the local file set after the upload pass. Used to
// keep R2 in sync per-project when local masters get renamed or legacy
// hashed files get cleaned up. Listed orphans are printed before
// deletion so any surprise shows in stdout. Single-file args are
// ignored (prune only operates on directory prefixes).
const PRUNE = rawArgs.includes('--prune');
// Confirms a LARGE prune (see the safety guard at the prune pass). Without
// it, a prune that would delete more than the threshold aborts — protection
// against running --prune from a machine that's missing the gitignored
// local media (fresh checkout, second machine), where "not present locally"
// describes the entire R2 copy of a project.
const ASSUME_YES = rawArgs.includes('--yes');
const args = rawArgs.filter((a) => a !== '--force-headers' && a !== '--prune');
if (args.length === 0) {
  console.error('Usage: node --env-file=.env.local scripts/sync-to-store.mjs [--force-headers] [--prune] <path>...');
  process.exit(1);
}

const allFiles = args.flatMap(walk);
if (allFiles.length === 0) {
  console.error('No files found at the provided path(s).');
  process.exit(1);
}

console.log(`R2 sync → ${R2_BUCKET}${FORCE_HEADERS ? '  [--force-headers: refresh metadata only]' : ''}`);
console.log(`Discovered ${allFiles.length} local file${allFiles.length === 1 ? '' : 's'}.\n`);

let uploaded = 0, skipped = 0, failed = 0, refreshed = 0;
// Cache-bust tripwire: collect files whose CONTENT changed under an existing,
// long-lived (30d), non-hashed name. Those serve stale to returning visitors /
// the edge for the life of the Cache-Control, and ONLY a URL change busts that.
// Surfacing them at sync time is the fix for the silent staleness that shipped
// the 0:11 title re-cut stale (it kept its name).
const staleRisk = [];
const queue = [...allFiles];
const inFlight = new Set();

async function next() {
  const abs = queue.shift();
  if (!abs) return;
  const key = localToKey(abs);
  const p = (async () => {
    try {
      // --force-headers path: skip the byte-equality check and use
      // CopyObject in-place to refresh Cache-Control / Content-Type.
      // The remote object must exist (CopyObject 404s otherwise),
      // which is the normal case after a regular sync run.
      if (FORCE_HEADERS) {
        const remoteTag = await remoteETag(key);
        if (!remoteTag) {
          // Object isn't on R2 yet — refresh has nothing to do.
          // Don't fall through to upload; that's not what
          // --force-headers asked for.
          process.stdout.write(`  · ${key} (skipped — not on R2 yet)\n`);
          skipped++;
          return;
        }
        process.stdout.write(`  ↻ ${key} (refresh headers)\n`);
        await refreshHeaders(abs, key);
        refreshed++;
        return;
      }

      const localTag = await localETag(abs);
      const remoteTag = await remoteETag(key);
      if (remoteTag === localTag) {
        skipped++;
        process.stdout.write(`  · ${key} (unchanged)\n`);
        return;
      }
      const verb = remoteTag ? 'updating' : 'uploading';
      process.stdout.write(`  ↑ ${key} (${verb}, ${(statSync(abs).size / 1024).toFixed(1)} KB)\n`);
      // An UPDATE (remoteTag existed → content differs) to a 30d-tier, non-hashed
      // name is cache-bust-exposed. A NEW upload (no remoteTag) is fine.
      if (remoteTag && cacheControlFor(abs).includes('max-age=2592000')) staleRisk.push(key);
      await uploadOne(abs, key);
      uploaded++;
    } catch (err) {
      failed++;
      process.stderr.write(`  ✗ ${key} — ${err.message}\n`);
    } finally {
      inFlight.delete(p);
    }
  })();
  inFlight.add(p);
}

// Drain the queue with bounded concurrency.
while (queue.length || inFlight.size) {
  while (inFlight.size < CONCURRENCY && queue.length) await next();
  if (inFlight.size) await Promise.race(inFlight);
}

if (FORCE_HEADERS) {
  console.log(`\nDone. ${refreshed} refreshed, ${skipped} skipped, ${failed} failed.`);
} else {
  console.log(`\nDone. ${uploaded} uploaded, ${skipped} unchanged, ${failed} failed.`);
}

if (!FORCE_HEADERS && staleRisk.length) {
  console.warn(`\n⚠  CACHE-BUST NEEDED — ${staleRisk.length} file(s) CHANGED under an existing 30d-cached name:`);
  for (const k of staleRisk.slice(0, 12)) console.warn(`     - ${k}`);
  if (staleRisk.length > 12) console.warn(`     ... +${staleRisk.length - 12} more`);
  console.warn(`   Returning visitors and the CDN edge serve the OLD bytes for up to 30 days; only a URL change busts that.`);
  console.warn(`   Fix: rename each changed asset (e.g. <name>-v2) and repoint its reference, OR purge those exact URLs in the Cloudflare dashboard.`);
  console.warn(`   (Posters auto-bust IF their video was renamed; a poster re-pick or raw-hero re-export under the same name does NOT.)`);
}

// ─── Prune: delete R2 orphans under each directory arg's prefix ──
let pruneDeleted = 0;
let pruneFailed = 0;
if (PRUNE && !FORCE_HEADERS) {
  // Derive prune prefixes: one per DIRECTORY arg (single-file args
  // skipped — pruning makes no sense for a single-file upload).
  const prunePrefixes = [];
  for (const arg of args) {
    const abs = resolve(arg);
    try {
      if (statSync(abs).isDirectory()) {
        const prefix = localToKey(abs) + '/';
        prunePrefixes.push(prefix);
      }
    } catch { /* ignore — path didn't resolve */ }
  }

  if (prunePrefixes.length === 0) {
    console.log('\nPrune: skipped (no directory args).');
  } else {
    // Build set of keys we just uploaded/considered — anything not in
    // this set under the prune prefixes is an orphan.
    const localKeySet = new Set(allFiles.map(localToKey));
    const orphanKeys = [];
    let listed = 0;

    for (const prefix of prunePrefixes) {
      let token;
      do {
        const r = await s3.send(new ListObjectsV2Command({
          Bucket: R2_BUCKET,
          Prefix: prefix,
          ContinuationToken: token,
        }));
        for (const obj of (r.Contents || [])) {
          listed++;
          if (!localKeySet.has(obj.Key)) orphanKeys.push(obj.Key);
        }
        token = r.NextContinuationToken;
      } while (token);
    }

    if (orphanKeys.length === 0) {
      console.log(`\nPrune: scanned ${listed} R2 object${listed === 1 ? '' : 's'} across ${prunePrefixes.length} prefix${prunePrefixes.length === 1 ? '' : 'es'}, 0 orphans.`);
    } else {
      // ── Safety guard ───────────────────────────────────────────────
      // R2 is the ONLY copy of the gitignored media (mp4s, posters, the
      // whole projects-opt tree, image masters since B4). A normal
      // per-project re-cut orphans a handful of renamed files; a fresh
      // checkout or wiped local folder makes EVERYTHING under the prefix
      // look orphaned. Refuse suspicious volumes unless --yes is passed,
      // and always print the full list BEFORE any delete request.
      const tooMany = orphanKeys.length > 10 || orphanKeys.length / listed > 0.3;
      if (tooMany && !ASSUME_YES) {
        console.log(`\nPrune ABORTED: ${orphanKeys.length} of ${listed} listed objects (${Math.round((orphanKeys.length / listed) * 100)}%) are missing locally — that's above the safety threshold (>10 or >30%).`);
        console.log('These R2 objects would have been deleted:');
        for (const k of orphanKeys) process.stdout.write(`  ? ${k}\n`);
        console.log('\nIf this is a real cleanup, re-run with --yes. If you are on a fresh');
        console.log('checkout or a second machine, DO NOT — these files exist only on R2.');
        process.exit(2);
      }
      console.log(`\nPrune: scanned ${listed} R2 objects, found ${orphanKeys.length} orphan${orphanKeys.length === 1 ? '' : 's'} not present locally. Deleting:`);
      for (const k of orphanKeys) process.stdout.write(`  ✗ ${k}\n`);
      // S3 DeleteObjects accepts up to 1000 keys per request.
      for (let i = 0; i < orphanKeys.length; i += 1000) {
        const batch = orphanKeys.slice(i, i + 1000);
        try {
          const r = await s3.send(new DeleteObjectsCommand({
            Bucket: R2_BUCKET,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }));
          pruneDeleted += batch.length - (r.Errors || []).length;
          if (r.Errors && r.Errors.length) {
            pruneFailed += r.Errors.length;
            for (const e of r.Errors) {
              process.stderr.write(`  ! delete failed: ${e.Key} — ${e.Message}\n`);
            }
          }
        } catch (err) {
          pruneFailed += batch.length;
          process.stderr.write(`  ! batch delete error: ${err.message}\n`);
        }
      }
      console.log(`Prune: deleted ${pruneDeleted} orphan${pruneDeleted === 1 ? '' : 's'}${pruneFailed > 0 ? `, ${pruneFailed} failed` : ''}.`);
    }
  }
}

process.exit((failed > 0 || pruneFailed > 0) ? 1 : 0);
