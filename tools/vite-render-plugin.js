// Dev-only "Render Studio" — a staging + job-queue UI for turning grayscale
// source (stills + mp4s) into high-res Higgsfield renders.
//
// The pipeline is Claude-in-the-loop: this plugin only stages files and a
// manifest.json job queue. It never calls Higgsfield itself. The flow is:
//
//   1. You create a shot, upload a grayscale still, and write a *brief* — the
//      look in your own words. "Enhance prompt" queues a prompt job; Claude
//      engineers the real prompt and extracts look-lock tokens, POSTing them
//      back to /prompt-result.  → promptJob.status = 'done'
//   2. You queue styleframes.  → styleframeJob.status = 'queued'
//   3. Claude reads the manifest, generates styleframes with the Higgsfield
//      tools, and POSTs the results back to /ingest.  → status = 'done'
//   4. You approve one styleframe, upload the grayscale mp4, and queue the
//      video. The approved frame + look lock are the adherence contract.
//   5. Claude generates the styleframe-guided render and ingests it.
//
// Everything lives under tools/render-studio/ (gitignored) and this whole
// plugin is `apply: 'serve'`, so nothing here ships to the production build.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.resolve(__dirname, './render.html');
const ROOT = path.resolve(__dirname, './render-studio'); // working dir (gitignored)
const MANIFEST = path.join(ROOT, 'manifest.json');
const UPLOADS = path.join(ROOT, 'uploads');
const STYLEFRAMES = path.join(ROOT, 'styleframes');
const RENDERS = path.join(ROOT, 'renders');

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

// ── manifest helpers ──────────────────────────────────────────────────────
const ensureDirs = () => {
  for (const d of [ROOT, UPLOADS, STYLEFRAMES, RENDERS]) fs.mkdirSync(d, { recursive: true });
};
const blankJob = () => ({ status: 'idle', requestedAt: null, error: '', note: '' });
const readManifest = () => {
  ensureDirs();
  let m = { shots: [] };
  if (fs.existsSync(MANIFEST)) {
    try {
      m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    } catch {
      m = { shots: [] };
    }
  }
  // Back-fill fields added after a shot was created (prompt pipeline).
  for (const s of m.shots || []) {
    s.brief ??= '';
    s.lookLock ??= [];
    s.promptJob ??= blankJob();
    s.segments ??= [];
  }
  return m;
};
const writeManifest = (m) => {
  ensureDirs();
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
};
const findShot = (m, id) => m.shots.find((s) => s.id === id);
const id = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Public shape the UI/Claude consume (paths already turned into served URLs).
// Cache-buster is the file's mtime — stable across polls (Date.now() here made
// every /api/state snapshot unique, causing the UI to re-render every tick).
const asUrl = (rel) => {
  if (!rel) return null;
  let v = 0;
  try {
    v = Math.floor(fs.statSync(path.join(ROOT, rel)).mtimeMs);
  } catch {}
  return `/render/files/${rel}?v=${v}`;
};
const publicShot = (s) => ({
  ...s,
  still: s.still ? { ...s.still, url: asUrl(s.still.file) } : null,
  video: s.video ? { ...s.video, url: asUrl(s.video.file) } : null,
  styleframes: (s.styleframes || []).map((f) => ({ ...f, url: asUrl(f.file) })),
  renders: (s.renders || []).map((r) => ({ ...r, url: asUrl(r.file) })),
});
const publicState = (m) => ({ shots: m.shots.map(publicShot) });

// ── request/response helpers ─────────────────────────────────────────────
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 300 * 1024 * 1024) reject(new Error('Upload too large (max 300 MB).'));
      else chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
const sendJSON = (res, code, obj) => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
};

// Stream a raw request body straight to disk (no base64/JSON round-trip —
// required for real mp4 sources, which blow past browser string limits when
// data-URL-encoded). Resolves with bytes written.
const RAW_MAX = 2 * 1024 * 1024 * 1024; // 2 GB
const readRawToFile = (req, dest) =>
  new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(dest);
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > RAW_MAX) {
        ws.destroy();
        req.destroy();
        reject(new Error('Upload too large (max 2 GB).'));
      }
    });
    req.pipe(ws);
    ws.on('finish', () => resolve(size));
    ws.on('error', reject);
    req.on('error', reject);
  });

// Decode a data URL to { buffer, ext }. Accepts images and video.
const decodeDataUrl = (dataUrl) => {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  const [, mime, b64] = m;
  const ext =
    Object.entries(MIME).find(([, v]) => v === mime)?.[0] || (mime.startsWith('video/') ? '.mp4' : '.jpg');
  return { buffer: Buffer.from(b64, 'base64'), ext, mime };
};

// Optimize a still to a ≤2048px q90 JPEG via macOS `sips` (repo media
// convention; never upscales). Falls back to the raw bytes if sips is absent.
// File-based so streamed uploads never round-trip through memory.
const optimizeStillFile = (tmpFile, ext, outNoExt) => {
  const out = `${outNoExt}.jpg`;
  try {
    const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', tmpFile], {
      encoding: 'utf8',
    });
    const w = +(dims.match(/pixelWidth: (\d+)/)?.[1] || 0);
    const h = +(dims.match(/pixelHeight: (\d+)/)?.[1] || 0);
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90'];
    if (Math.max(w, h) > 2048) args.push('-Z', '2048');
    execFileSync('sips', [...args, tmpFile, '--out', out], { stdio: 'ignore' });
    return out;
  } catch {
    const raw = `${outNoExt}${ext}`;
    fs.copyFileSync(tmpFile, raw);
    return raw;
  }
};
const optimizeStill = (buf, ext, outNoExt) => {
  ensureDirs();
  const tmp = `${outNoExt}.tmp${ext}`;
  fs.writeFileSync(tmp, buf);
  try {
    return optimizeStillFile(tmp, ext, outNoExt);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
};

const rmSafe = (rel) => {
  if (!rel) return;
  const abs = path.join(ROOT, rel);
  if (abs.startsWith(ROOT) && fs.existsSync(abs)) fs.rmSync(abs, { force: true });
};

export default function renderPlugin() {
  return {
    name: 'render-studio',
    apply: 'serve', // dev server only — never part of the production build
    configureServer(server) {
      // Serve staged media: /render/files/<relpath> (dev only).
      server.middlewares.use('/render/files', (req, res, next) => {
        try {
          const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
          const abs = path.join(ROOT, rel);
          if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory())
            return next();
          res.setHeader('content-type', MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
          res.setHeader('cache-control', 'no-cache');
          fs.createReadStream(abs).pipe(res);
        } catch {
          next();
        }
      });

      server.middlewares.use('/render', async (req, res, next) => {
        try {
          const url = (req.url || '/').split('?')[0];
          const method = req.method;

          // ── Page ──
          if (method === 'GET' && (url === '/' || url === '')) {
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end(fs.readFileSync(HTML_FILE, 'utf8'));
            return;
          }

          // ── Full state (UI polls this) ──
          if (method === 'GET' && url === '/api/state') {
            return sendJSON(res, 200, publicState(readManifest()));
          }

          // ── Pending queue (convenience list for Claude) ──
          // Prompt jobs come first: they gate generation. Each entry carries
          // everything the runner needs (brief, prompt, look lock, media URLs).
          if (method === 'GET' && url === '/api/jobs') {
            const m = readManifest();
            const jobs = [];
            for (const s of m.shots) {
              if (s.promptJob?.status === 'queued')
                jobs.push({
                  shotId: s.id, title: s.title, kind: 'prompt',
                  brief: s.brief, prompt: s.prompt, lookLock: s.lookLock,
                  still: asUrl(s.still?.file),
                  ...s.promptJob,
                });
            }
            for (const s of m.shots) {
              if (s.styleframeJob?.status === 'queued')
                jobs.push({
                  shotId: s.id, title: s.title, kind: 'styleframe',
                  brief: s.brief, prompt: s.prompt, lookLock: s.lookLock,
                  still: asUrl(s.still?.file),
                  ...s.styleframeJob,
                });
              if (s.renderJob?.status === 'queued') {
                const sf = (s.styleframes || []).find((f) => f.id === s.renderJob.styleframeId);
                jobs.push({
                  shotId: s.id, title: s.title, kind: 'render',
                  lookLock: s.lookLock,
                  video: asUrl(s.video?.file), styleframe: asUrl(sf?.file),
                  ...s.renderJob,
                });
              }
            }
            return sendJSON(res, 200, { jobs });
          }

          // ── Create a shot ──
          if (method === 'POST' && url === '/api/shots') {
            const { title } = await readBody(req);
            const m = readManifest();
            const shot = {
              id: id('shot'),
              title: String(title || '').trim() || `Shot ${m.shots.length + 1}`,
              createdAt: Date.now(),
              brief: '', // the user's own words — Claude engineers `prompt` from this
              prompt: '', // engineered prompt actually sent to Higgsfield (editable)
              lookLock: [], // locked look tokens; every job must stay adherent to these
              segments: [], // timeline parts of the mp4, each with its own look anchor
              still: null,
              video: null,
              styleframes: [],
              approvedStyleframeId: null,
              renders: [],
              promptJob: blankJob(),
              styleframeJob: blankJob(),
              renderJob: blankJob(),
            };
            m.shots.unshift(shot);
            writeManifest(m);
            return sendJSON(res, 200, publicState(m));
          }

          // Per-shot routes: /api/shots/:id[/...]
          if (url.startsWith('/api/shots/')) {
            const rest = url.slice('/api/shots/'.length);
            const [shotId, ...segs] = rest.split('/');
            const sub = segs.join('/');
            const m = readManifest();
            const shot = findShot(m, decodeURIComponent(shotId));
            if (!shot) return sendJSON(res, 404, { error: 'Shot not found.' });

            // Update title / brief / prompt / look lock.
            if (method === 'PATCH' && sub === '') {
              const body = await readBody(req);
              if (body.title !== undefined) shot.title = String(body.title).trim() || shot.title;
              if (body.brief !== undefined) shot.brief = String(body.brief);
              if (body.prompt !== undefined) shot.prompt = String(body.prompt);
              if (Array.isArray(body.lookLock))
                shot.lookLock = body.lookLock.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
              if (Array.isArray(body.segments))
                shot.segments = body.segments.slice(0, 24).map((g) => ({
                  id: String(g.id || '').trim() || id('seg'),
                  label: String(g.label || '').slice(0, 80),
                  tStart: Math.max(0, Number(g.tStart) || 0),
                  tEnd: Math.max(0, Number(g.tEnd) || 0),
                  element: String(g.element || '').trim(), // Higgsfield element name or UUID
                  styleframeId: String(g.styleframeId || ''), // or a gallery frame as anchor
                  tweaks: String(g.tweaks || ''),
                }));
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Delete a shot and all its files.
            if (method === 'DELETE' && sub === '') {
              rmSafe(shot.still?.file);
              rmSafe(shot.video?.file);
              (shot.styleframes || []).forEach((f) => rmSafe(f.file));
              (shot.renders || []).forEach((r) => rmSafe(r.file));
              m.shots = m.shots.filter((s) => s.id !== shot.id);
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Upload a grayscale still or source video.
            if (method === 'POST' && sub === 'upload') {
              const { kind, dataUrl, name = 'upload' } = await readBody(req);
              const dec = decodeDataUrl(dataUrl);
              if (!dec) return sendJSON(res, 400, { error: 'Send the file as a data URL.' });
              if (kind === 'still') {
                rmSafe(shot.still?.file);
                fs.mkdirSync(path.join(UPLOADS, shot.id), { recursive: true });
                const abs = optimizeStill(dec.buffer, dec.ext, path.join(UPLOADS, shot.id, 'still'));
                shot.still = { file: path.relative(ROOT, abs), name: String(name) };
              } else if (kind === 'video') {
                rmSafe(shot.video?.file);
                fs.mkdirSync(path.join(UPLOADS, shot.id), { recursive: true });
                const ext = MIME[dec.ext] ? dec.ext : '.mp4';
                const abs = path.join(UPLOADS, shot.id, `source${ext}`);
                fs.writeFileSync(abs, dec.buffer);
                shot.video = { file: path.relative(ROOT, abs), name: String(name) };
              } else {
                return sendJSON(res, 400, { error: "kind must be 'still' or 'video'." });
              }
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Raw streaming upload — bytes in the body, meta in the query
            // string. The UI uses this (not the JSON route) so real mp4
            // sources never get base64/JSON-encoded in the browser.
            if (method === 'POST' && sub === 'upload-raw') {
              const q = new URLSearchParams((req.url || '').split('?')[1] || '');
              const kind = q.get('kind');
              const name = q.get('name') || 'upload';
              if (kind !== 'still' && kind !== 'video')
                return sendJSON(res, 400, { error: "kind must be 'still' or 'video'." });
              const ctype = String(req.headers['content-type'] || '').split(';')[0];
              const extFromType = Object.entries(MIME).find(([, v]) => v === ctype)?.[0];
              const nameExt = path.extname(name).toLowerCase();
              const ext =
                extFromType || (MIME[nameExt] ? nameExt : kind === 'still' ? '.jpg' : '.mp4');

              fs.mkdirSync(path.join(UPLOADS, shot.id), { recursive: true });
              const tmp = path.join(UPLOADS, shot.id, `.tmp-${Date.now()}${ext}`);
              try {
                await readRawToFile(req, tmp);
                if (kind === 'still') {
                  rmSafe(shot.still?.file);
                  const abs = optimizeStillFile(tmp, ext, path.join(UPLOADS, shot.id, 'still'));
                  shot.still = { file: path.relative(ROOT, abs), name: String(name) };
                } else {
                  rmSafe(shot.video?.file);
                  const abs = path.join(UPLOADS, shot.id, `source${ext}`);
                  fs.renameSync(tmp, abs);
                  shot.video = { file: path.relative(ROOT, abs), name: String(name) };
                }
              } finally {
                if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
              }
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Queue prompt enhancement: Claude turns the brief (the user's own
            // words) into an engineered prompt + look-lock tokens.
            if (method === 'POST' && sub === 'queue-prompt') {
              if (!String(shot.brief || '').trim() && !String(shot.prompt || '').trim())
                return sendJSON(res, 400, { error: 'Write a brief first — the look in your own words.' });
              shot.promptJob = { status: 'queued', requestedAt: Date.now(), error: '', note: '' };
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // ── Claude → app: enhanced prompt + look lock ──
            if (method === 'POST' && sub === 'prompt-result') {
              const { enhancedPrompt, lookLock, note = '' } = await readBody(req);
              if (!String(enhancedPrompt || '').trim())
                return sendJSON(res, 400, { error: 'enhancedPrompt required.' });
              shot.prompt = String(enhancedPrompt).trim();
              if (Array.isArray(lookLock))
                shot.lookLock = lookLock.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
              shot.promptJob = {
                ...(shot.promptJob || blankJob()),
                status: 'done',
                error: '',
                note: String(note),
              };
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Queue styleframe generation.
            if (method === 'POST' && sub === 'queue-styleframes') {
              if (!shot.still) return sendJSON(res, 400, { error: 'Upload a grayscale still first.' });
              const { count = 3 } = await readBody(req);
              shot.styleframeJob = {
                status: 'queued',
                requestedAt: Date.now(),
                count: Math.max(1, Math.min(6, +count || 3)),
                error: '',
                note: '',
              };
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Approve a styleframe as the look reference.
            if (method === 'POST' && sub.startsWith('approve/')) {
              const sfId = decodeURIComponent(sub.slice('approve/'.length));
              const sf = (shot.styleframes || []).find((f) => f.id === sfId);
              if (!sf) return sendJSON(res, 404, { error: 'Styleframe not found.' });
              shot.approvedStyleframeId = shot.approvedStyleframeId === sfId ? null : sfId;
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Delete a styleframe.
            if (method === 'DELETE' && sub.startsWith('styleframes/')) {
              const sfId = decodeURIComponent(sub.slice('styleframes/'.length));
              const sf = (shot.styleframes || []).find((f) => f.id === sfId);
              if (sf) rmSafe(sf.file);
              shot.styleframes = (shot.styleframes || []).filter((f) => f.id !== sfId);
              if (shot.approvedStyleframeId === sfId) shot.approvedStyleframeId = null;
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // Queue the styleframe-guided video render.
            if (method === 'POST' && sub === 'queue-render') {
              if (!shot.video) return sendJSON(res, 400, { error: 'Upload the grayscale mp4 first.' });
              const segs = shot.segments || [];
              const segsAnchored = segs.length > 0 && segs.every((g) => g.element || g.styleframeId);
              if (!shot.approvedStyleframeId && !segsAnchored)
                return sendJSON(res, 400, {
                  error: segs.length
                    ? 'Every segment needs a look anchor (element or gallery frame) — or approve a styleframe.'
                    : 'Approve a styleframe to guide the render first.',
                });
              const body = await readBody(req);
              shot.renderJob = {
                status: 'queued',
                requestedAt: Date.now(),
                styleframeId: shot.approvedStyleframeId,
                prompt: String(body.prompt || '').trim() || shot.prompt,
                lookLock: [...(shot.lookLock || [])], // adherence contract for the render
                segments: segs.map((g) => ({ ...g })), // per-part look anchors + tweaks
                error: '',
                note: '',
              };
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // ── Claude → app: update a job's status/note/error ──
            if (method === 'POST' && sub === 'job') {
              const { kind, status, error = '', note = '' } = await readBody(req);
              const jobKey =
                kind === 'render' ? 'renderJob' : kind === 'prompt' ? 'promptJob' : 'styleframeJob';
              if (!shot[jobKey]) shot[jobKey] = blankJob();
              if (status) shot[jobKey].status = status;
              shot[jobKey].error = error;
              shot[jobKey].note = note;
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }

            // ── Claude → app: ingest a generated result (from URL or data URL) ──
            if (method === 'POST' && sub === 'ingest') {
              const { kind, url: srcUrl, dataUrl, note = '', model = '' } = await readBody(req);
              let buffer, ext;
              if (dataUrl) {
                const dec = decodeDataUrl(dataUrl);
                if (!dec) return sendJSON(res, 400, { error: 'Bad data URL.' });
                ({ buffer, ext } = dec);
              } else if (srcUrl) {
                const resp = await fetch(srcUrl);
                if (!resp.ok) return sendJSON(res, 400, { error: `Fetch failed: ${resp.status}` });
                buffer = Buffer.from(await resp.arrayBuffer());
                const ct = resp.headers.get('content-type') || '';
                ext =
                  Object.entries(MIME).find(([, v]) => v === ct.split(';')[0])?.[0] ||
                  path.extname(new URL(srcUrl).pathname) ||
                  (kind === 'render' ? '.mp4' : '.jpg');
              } else {
                return sendJSON(res, 400, { error: 'Provide url or dataUrl.' });
              }

              if (kind === 'render') {
                fs.mkdirSync(path.join(RENDERS, shot.id), { recursive: true });
                const rid = id('render');
                const abs = path.join(RENDERS, shot.id, `${rid}${ext || '.mp4'}`);
                fs.writeFileSync(abs, buffer);
                shot.renders = shot.renders || [];
                shot.renders.unshift({
                  id: rid,
                  file: path.relative(ROOT, abs),
                  createdAt: Date.now(),
                  styleframeId: shot.renderJob?.styleframeId || shot.approvedStyleframeId || null,
                  model: String(model),
                  note: String(note),
                });
                shot.renderJob = { ...(shot.renderJob || blankJob()), status: 'done', error: '', note: String(note) };
              } else {
                fs.mkdirSync(path.join(STYLEFRAMES, shot.id), { recursive: true });
                const sid = id('sf');
                const abs = path.join(STYLEFRAMES, shot.id, `${sid}${ext || '.jpg'}`);
                fs.writeFileSync(abs, buffer);
                shot.styleframes = shot.styleframes || [];
                shot.styleframes.push({
                  id: sid,
                  file: path.relative(ROOT, abs),
                  createdAt: Date.now(),
                  model: String(model),
                  note: String(note),
                });
                shot.styleframeJob = {
                  ...(shot.styleframeJob || blankJob()),
                  status: 'done',
                  error: '',
                  note: String(note),
                };
              }
              writeManifest(m);
              return sendJSON(res, 200, publicState(m));
            }
          }

          next();
        } catch (err) {
          sendJSON(res, 500, { error: String(err?.message || err) });
        }
      });
    },
  };
}
