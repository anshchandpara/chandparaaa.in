#!/usr/bin/env node
/**
 * build-sitemap.mjs — write public/sitemap.xml from projects.json.
 *
 * Runs as part of `prebuild`, so the sitemap is regenerated on every build
 * and Vite copies it into dist. It is committed too: a diff on it is the
 * honest record of what became indexable when.
 *
 * Routes are the site's real ones — query URLs, `?p=<slug>` — which every
 * search engine accepts in a sitemap. Only published entries are listed;
 * drafts still preview by direct URL but are nobody's business to index.
 *
 * No <lastmod>: a date that is not true is worse than none, and nothing here
 * tracks when a project's page last changed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'https://chandparaaa.in';

const data = JSON.parse(await readFile(join(ROOT, 'src', 'data', 'projects.json'), 'utf8'));
const published = [...(data.work || []), ...(data.lab || [])].filter((p) => !p.draft);

const urls = [
  `${ORIGIN}/`,
  `${ORIGIN}/?page=about`,
  ...published.map((p) => `${ORIGIN}/?p=${encodeURIComponent(p.slug)}`),
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`),
  '</urlset>',
  '',
].join('\n');

const out = join(ROOT, 'public', 'sitemap.xml');
await writeFile(out, xml);
console.log(`[sitemap] ${urls.length} URLs → public/sitemap.xml (${published.length} published projects)`);
