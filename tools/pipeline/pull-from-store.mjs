#!/usr/bin/env node
/**
 * Restore local media from R2 — the counterpart to sync-to-store.mjs.
 *
 * ### Why this exists
 *
 * public/projects/ is gitignored, so a fresh clone has no media and `npm run
 * dev` serves 404s (dev deliberately does NOT set VITE_MEDIA_BASE_URL, so it
 * reads from disk). You also need the files locally to regenerate the manifest,
 * because build-media-manifest.mjs scans the disk.
 *
 * It is also the recovery path for a specific trap, hit 2026-09-01: ship.sh
 * checks out main, ff-merges, and checks out dev again. If a commit in that
 * range untracks a directory, git DELETES those working-tree files during the
 * checkout — .gitignore does not protect files git was already tracking. The
 * media vanished locally while remaining safe on R2.
 *
 * READ-ONLY against R2. Downloads; never uploads, never deletes.
 * Skips files already present with a matching size, so re-runs are cheap.
 *
 *   node --env-file=.env.local tools/pipeline/pull-from-store.mjs
 *   npm run media:pull
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEST = join(ROOT, 'public');
const CONCURRENCY = 8;

const { R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
for (const [k, v] of Object.entries({ R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY })) {
  if (!v) { console.error(`[pull] missing env var ${k}. Pass --env-file=.env.local`); process.exit(2); }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT.trim(),
  credentials: { accessKeyId: R2_ACCESS_KEY_ID.trim(), secretAccessKey: R2_SECRET_ACCESS_KEY.trim() },
});
const BUCKET = R2_BUCKET.trim();

async function listAll(prefix) {
  const out = [];
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000,
    }));
    for (const o of r.Contents ?? []) out.push(o);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

const objects = [...await listAll('projects/'), ...await listAll('about/')];
if (objects.length === 0) {
  console.error('[pull] bucket has no media under projects/ or about/. Nothing to restore.');
  process.exit(1);
}
console.log(`[pull] ${objects.length} object(s) in ${BUCKET}`);

let got = 0, skipped = 0, failed = 0;
async function pull(o) {
  const dest = join(DEST, o.Key);
  if (existsSync(dest)) {
    const s = await stat(dest);
    if (s.size === o.Size) { skipped += 1; return; }   // already correct
  }
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: o.Key }));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await r.Body.transformToByteArray()));
    got += 1;
    if (got % 25 === 0) console.log(`  ${got} downloaded...`);
  } catch (e) {
    console.error(`  FAILED ${o.Key}: ${e.message}`);
    failed += 1;
  }
}

const queue = [...objects];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) await pull(queue.shift());
}));

console.log(`\n[pull] ${got} downloaded, ${skipped} already present, ${failed} failed.`);
if (failed) process.exit(1);
console.log('[pull] Regenerate the manifest if anything changed: npm run media:manifest');
