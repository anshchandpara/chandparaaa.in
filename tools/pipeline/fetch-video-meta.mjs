#!/usr/bin/env node
/**
 * Record each Vimeo film's true aspect ratio in projects.json.
 *
 * ### Why
 *
 * The hero is a fixed box (16/9 capped at 88vh, so ~2.02:1 on a laptop) and the
 * films are not one shape: Lootere is 1.775, Equals is 2.393 scope. A single
 * hardcoded iframe aspect fills one and adds bars to the other. To make every
 * film cover its hero the way .pd__hero-img already does, the CSS needs each
 * video's own aspect — so it is fetched once and stored.
 *
 * Reads Vimeo's public oEmbed endpoint. No credentials, no writes to Vimeo.
 * Only touches entries that HAVE a video id and are missing videoAspect,
 * unless --force.
 *
 *   npm run media:video-meta
 *   npm run media:video-meta -- --force     # refetch everything
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FILE = join(ROOT, 'src', 'data', 'projects.json');
const FORCE = process.argv.includes('--force');

const data = JSON.parse(await readFile(FILE, 'utf8'));
const targets = [];
for (const bucket of ['work', 'lab']) {
  for (const e of data[bucket] ?? []) {
    if (e.video && (FORCE || !e.videoAspect)) targets.push(e);
  }
}

if (targets.length === 0) {
  console.log('[video-meta] nothing to fetch — every entry with a video already has an aspect.');
  process.exit(0);
}
console.log(`[video-meta] fetching ${targets.length} video(s)`);

let ok = 0, failed = 0;
for (const e of targets) {
  const url = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${e.video}`)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`oEmbed HTTP ${r.status}`);
    const j = await r.json();
    if (!j.width || !j.height) throw new Error('oEmbed returned no dimensions');
    const aspect = +(j.width / j.height).toFixed(4);
    e.videoAspect = aspect;
    console.log(`  ${e.slug.padEnd(28)} ${j.width}x${j.height}  aspect ${aspect}  ${j.title ?? ''}`.trimEnd());
    ok += 1;
  } catch (err) {
    // Loud skip, never a silent default: a wrong aspect crops the film wrongly,
    // and guessing 16/9 would look deliberate rather than broken.
    console.error(`  ${e.slug.padEnd(28)} FAILED — ${err.message}`);
    failed += 1;
  }
}

if (ok) {
  // Repo convention: 2-space indent, unicode preserved, trailing newline.
  await writeFile(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n[video-meta] wrote ${ok} aspect(s) to src/data/projects.json`);
}
if (failed) {
  console.error(`[video-meta] ${failed} failed — those entries fall back to 16/9 in CSS.`);
  process.exit(1);
}
