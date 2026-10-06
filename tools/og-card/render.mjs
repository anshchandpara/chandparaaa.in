#!/usr/bin/env node
/**
 * render.mjs — the site's share card (Open Graph / Twitter), 1200×630.
 *
 *   npm run og:card -- public/og-v2.jpg
 *
 * 1. Pulls the backdrop from the hero loop: public/hero-loop.mp4 at 1.00 s,
 *    full 2560×1440 (the card crops it centred, object-fit: cover).
 * 2. Serves tools/og-card/ on 127.0.0.1 and loads card.html in headless
 *    Chrome at 2× — the Adobe kit is allowlisted for localhost.
 * 3. Refuses to shoot unless Obviously Variable actually loaded: a card set in
 *    the fallback face would ship silently otherwise.
 * 4. Downsamples the 2400×1260 shot to 1200×630 (oiiotool) and writes a JPEG.
 *
 * Scrapers (WhatsApp, LinkedIn, X, Facebook) cache cards BY URL, so a changed
 * card needs a new filename — `og-v3.jpg` next time — and index.html +
 * src/lib/seo.js pointed at it. Never overwrite the live name in place.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = resolve(ROOT, process.argv[2] || 'public/og-v2.jpg');
const LOOP = join(ROOT, 'public', 'hero-loop.mp4');
const FRAME_AT = '1.00';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (existsSync(OUT)) {
  console.error(`[og-card] ${OUT} exists — scrapers cache by URL, so a new card gets a new name. Refusing to overwrite.`);
  process.exit(1);
}

const work = await mkdtemp(join(tmpdir(), 'og-card-'));
const frame = join(work, 'frame.jpg');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', FRAME_AT, '-i', LOOP, '-frames:v', '1', '-q:v', '2', frame]);

// Tiny static server: card.html from here, frame.jpg from the temp dir.
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const name = req.url.split('?')[0].replace(/^\//, '') || 'card.html';
  const file = name === 'frame.jpg' ? frame : join(HERE, name);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const DEBUG = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG}`, '--no-first-run',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });

let ws;
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json()).find((t) => t.type === 'page'); } catch {}
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('headless Chrome did not come up');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id) { pending.get(d.id)?.(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/card.html` });
  await sleep(1500);
  const ok = await evalJs(`(async () => {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 8000))]);
    await document.fonts.load('700 92px "obviously-variable"').catch(() => {});
    const img = document.querySelector('.card img');
    return document.fonts.check('700 92px "obviously-variable"') && img.complete && img.naturalWidth > 0;
  })()`);
  if (!ok) throw new Error('Obviously Variable (or the frame) did not load — not shooting a card in the fallback face');

  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 2 } });
  const png = join(work, 'card-2x.png');
  await writeFile(png, Buffer.from(shot.result.data, 'base64'));
  execFileSync('oiiotool', [png, '--resize', '1200x630', '--compression', 'jpeg:90', '-o', OUT]);
  console.log(`[og-card] wrote ${OUT}`);
} finally {
  ws?.close(); chrome.kill(); server.close();
}
