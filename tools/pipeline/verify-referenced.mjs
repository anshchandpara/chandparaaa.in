#!/usr/bin/env node
/**
 * Pre-ship gate: every media file the site references must exist in the bucket
 * AND be non-empty.
 *
 * ### Why this is manifest-driven, not a dist scan
 *
 * The upstream pack's version text-scans `dist/` for media URLs, and states its
 * own assumption: "client JS builds NO media URLs at runtime, so a text scan of
 * dist captures 100% of what browsers request."
 *
 * That assumption is false here. Since the manifest layer landed, every media
 * URL is assembled at runtime by src/lib/mediaManifest.js:
 *
 *     `${BASE}projects/${encodeURIComponent(slug)}/${encodeURIComponent(file)}`
 *
 * Measured 2026-08-09: dist contains ZERO complete media URLs. A dist scanner
 * would find nothing to check and exit 0 — a pass meaning "I did not look",
 * which is worse than no gate at all.
 *
 * So the expected key list comes from src/data/media-manifest.json, which is
 * precisely the thing that knows what the site references.
 *
 * ### Why non-empty matters
 *
 * A 0-byte object returns 200 and renders as a broken image with no fallback.
 * That is how an interrupted sync surfaces, so presence alone is not enough.
 *
 * READ-ONLY. Lists and heads objects. Never writes, never deletes.
 *
 *   node --env-file=.env.local tools/pipeline/verify-referenced.mjs
 *   node --env-file=.env.local tools/pipeline/verify-referenced.mjs --quiet
 *
 * Exit 0 = every referenced object present and non-empty.
 * Exit 1 = missing or empty objects (do not ship).
 * Exit 2 = setup error (no manifest, no credentials).
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MANIFEST = join(ROOT, 'src', 'data', 'media-manifest.json');
const QUIET = process.argv.includes('--quiet');

const { R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
for (const [k, v] of Object.entries({ R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY })) {
  if (!v) {
    console.error(`[verify] missing env var ${k}. Pass --env-file=.env.local`);
    process.exit(2);
  }
}
if (!existsSync(MANIFEST)) {
  console.error('[verify] no media manifest — cannot know what the site references.');
  process.exit(2);
}

/** Every object key the site can reference, derived from the manifest. */
function expectedKeys(manifest) {
  const keys = [];
  for (const [slug, p] of Object.entries(manifest.projects ?? {})) {
    for (const f of p.files ?? []) keys.push(`projects/${slug}/${f}`);
    if (p.hero) keys.push(`projects/${slug}/${p.hero}`);
    for (const c of p.compare ?? []) keys.push(`projects/${slug}/compare/${c}`);
  }
  for (const f of manifest.about ?? []) keys.push(`about/${f}`);
  return keys;
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT.trim(),
  credentials: { accessKeyId: R2_ACCESS_KEY_ID.trim(), secretAccessKey: R2_SECRET_ACCESS_KEY.trim() },
});

/**
 * One LIST sweep beats N HEAD calls: 273 HEADs is 273 round trips and 273
 * Class-B operations. Listing the prefixes gives size as well as presence in a
 * handful of requests.
 */
async function bucketIndex() {
  const index = new Map();
  for (const prefix of ['projects/', 'about/']) {
    let token;
    do {
      const r = await s3.send(new ListObjectsV2Command({
        Bucket: R2_BUCKET.trim(), Prefix: prefix, ContinuationToken: token, MaxKeys: 1000,
      }));
      for (const o of r.Contents ?? []) index.set(o.Key, o.Size);
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
  }
  return index;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const expected = expectedKeys(manifest);
if (expected.length === 0) {
  console.error('[verify] manifest lists no media at all — refusing to report a pass.');
  process.exit(2);
}

const index = await bucketIndex();
const missing = expected.filter((k) => !index.has(k));
const empty = expected.filter((k) => index.get(k) === 0);
const orphans = [...index.keys()].filter((k) => !expected.includes(k));

if (!QUIET || missing.length || empty.length) {
  console.log(`[verify] bucket ${R2_BUCKET.trim()}`);
  console.log(`[verify] referenced by the site: ${expected.length}`);
  console.log(`[verify] present in bucket:      ${index.size}`);
}

if (missing.length) {
  console.error(`\n[verify] MISSING ${missing.length} referenced object(s):`);
  for (const k of missing.slice(0, 20)) console.error(`  - ${k}`);
  if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
}
if (empty.length) {
  console.error(`\n[verify] EMPTY (0 bytes — serves 200 and renders broken) ${empty.length}:`);
  for (const k of empty.slice(0, 20)) console.error(`  - ${k}`);
}
if (orphans.length) {
  // Reported, never deleted. A project archived to an external drive looks
  // exactly like an orphan from the bucket's side (rule R3).
  console.log(`\n[verify] ${orphans.length} object(s) in the bucket the site does not reference.`);
  console.log('[verify] Reported only — nothing is deleted. Review before any prune.');
  for (const k of orphans.slice(0, 10)) console.log(`  ? ${k}`);
  if (orphans.length > 10) console.log(`  ... and ${orphans.length - 10} more`);
}

if (missing.length || empty.length) {
  console.error('\n[verify] FAIL — do not point the site at the bucket yet.');
  process.exit(1);
}
console.log('\n[verify] PASS — every referenced object is present and non-empty.');
