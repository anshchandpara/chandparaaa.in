// Dev-only authoring tool. Serves a small form at /admin that creates *draft*
// project slots in src/data/projects.json (title + optional metadata; content
// comes later). Runs only under `npm run dev` — `apply: 'serve'` keeps it out
// of the production build, so nothing here ships to dist.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../src/data/projects.json');
const PEOPLE_FILE = path.resolve(__dirname, '../src/data/people.json');
const DESIGN_FILE = path.resolve(__dirname, '../src/data/design.json');
const ABOUT_DIR = path.resolve(__dirname, '../src/media/about');
const PROJECT_MEDIA = path.resolve(__dirname, '../src/media/projects');
const HTML_FILE = path.resolve(__dirname, './admin.html');

// Match the repo convention: 2-space indent, unicode preserved, trailing newline.
const writeJSON = (file, d) => fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (d) => writeJSON(DATA_FILE, d);
const readPeople = () => JSON.parse(fs.readFileSync(PEOPLE_FILE, 'utf8'));
const writePeople = (d) => writeJSON(PEOPLE_FILE, d);
const readDesign = () => JSON.parse(fs.readFileSync(DESIGN_FILE, 'utf8'));
const writeDesign = (d) => writeJSON(DESIGN_FILE, d);

const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;

/** Media files for a project slug, sorted (mirrors src/lib/images.js). */
const mediaFor = (slug) => {
  const dir = path.join(PROJECT_MEDIA, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMG_RE.test(f))
    .sort()
    .map((f) => ({
      file: f,
      url: `/src/media/projects/${slug}/${encodeURIComponent(f)}`,
      size: fs.statSync(path.join(dir, f)).size,
    }));
};

/** Next free 3-digit name in a project's media dir, e.g. 012.jpg */
const nextMediaName = (dir, ext) => {
  let max = 0;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\d{3})\./);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${String(max + 1).padStart(3, '0')}.${ext}`;
};

// Optimize to the repo's convention: JPEG q82, max 2000px, never upscaled.
const optimizeInto = (tmpFile, outFile) => {
  try {
    const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', tmpFile], {
      encoding: 'utf8',
    });
    const w = +(dims.match(/pixelWidth: (\d+)/)?.[1] || 0);
    const h = +(dims.match(/pixelHeight: (\d+)/)?.[1] || 0);
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82'];
    if (Math.max(w, h) > 2000) args.push('-Z', '2000');
    execFileSync('sips', [...args, tmpFile, '--out', outFile], { stdio: 'ignore' });
    return true;
  } catch {
    fs.copyFileSync(tmpFile, outFile);
    return false;
  }
};

// Fields the project editor is allowed to write.
const EDITABLE = [
  'title', 'subtitle', 'category', 'client', 'platform', 'role',
  'desc', 'video', 'youtube', 'image',
];

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

// Current About portrait file, if any (first sorted image in ABOUT_DIR —
// mirrors src/lib/aboutImage.js).
const currentPortrait = () => {
  if (!fs.existsSync(ABOUT_DIR)) return null;
  const files = fs
    .readdirSync(ABOUT_DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  return files[0] || null;
};

const portraitInfo = () => {
  const file = currentPortrait();
  return file
    ? { exists: true, file, url: `/src/media/about/${file}?t=${Date.now()}` }
    : { exists: false, file: null, url: null };
};

// Optimize an uploaded image to a ≤2000px q82 JPEG via macOS `sips` (the
// repo's media-pipeline convention; never upscales). Falls back to keeping
// the original bytes if sips is unavailable.
const optimizePortrait = (tmpFile, ext) => {
  const out = path.join(ABOUT_DIR, 'portrait.jpg');
  try {
    const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', tmpFile], {
      encoding: 'utf8',
    });
    const w = +(dims.match(/pixelWidth: (\d+)/)?.[1] || 0);
    const h = +(dims.match(/pixelHeight: (\d+)/)?.[1] || 0);
    const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82'];
    if (Math.max(w, h) > 2000) args.push('-Z', '2000');
    execFileSync('sips', [...args, tmpFile, '--out', out], { stdio: 'ignore' });
    return out;
  } catch {
    const raw = path.join(ABOUT_DIR, `portrait.${ext}`);
    fs.copyFileSync(tmpFile, raw);
    return raw;
  }
};

// Names credited in a "Role — Name1, Name2" string (mirrors people.js parseCredit).
const namesFromCredit = (credit) => {
  const m = String(credit).match(/^(.*?)\s[—–-]\s(.*)$/);
  const rest = m ? m[2] : credit;
  return rest
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const uniqueSlug = (base, taken) => {
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  taken.add(slug);
  return slug;
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
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

// Lightweight list for the UI: title, draft flag, credits, and a cover thumb
// (the designated hero if set, else the first sorted image).
const thumbFor = (slug, image) => {
  const files = mediaFor(slug);
  if (!files.length) return '';
  const want = (image || '').split('/').pop();
  return (files.find((f) => f.file === want) || files[0]).url;
};

const listProjects = (data) => ({
  work: data.work.map((p) => ({
    slug: p.slug,
    title: p.title,
    num: p.num,
    draft: !!p.draft,
    credits: p.credits || [],
    thumb: thumbFor(p.slug, p.image),
  })),
  lab: data.lab.map((x) => ({
    slug: x.slug,
    title: x.title,
    code: x.code,
    draft: !!x.draft,
    thumb: thumbFor(x.slug, x.image),
  })),
});

const makeWorkDraft = (item, slug, num) => ({
  slug,
  num,
  title: item.title.trim(),
  category: item.category?.trim() || '',
  client: item.client?.trim() || '',
  year: Number.isFinite(+item.year) && item.year ? Number(item.year) : null,
  platform: item.platform?.trim() || '',
  role: item.role?.trim() || '',
  featured: false,
  draft: true,
  desc: '',
  credits: [],
  gallery: [],
  image: '',
  video: '',
});

const makeLabDraft = (item, slug, code) => ({
  slug,
  code,
  title: item.title.trim(),
  kind: item.category?.trim() || 'Experiment',
  year: Number.isFinite(+item.year) && item.year ? Number(item.year) : null,
  draft: true,
  desc: '',
  gallery: [],
  image: '',
  video: '',
});

export default function adminPlugin() {
  return {
    name: 'portfolio-admin',
    apply: 'serve', // dev server only — never part of the production build
    configureServer(server) {
      // Mounted at /admin → req.url has the prefix stripped by connect.
      server.middlewares.use('/admin', async (req, res, next) => {
        try {
          const url = (req.url || '/').split('?')[0];

          // Serve the form page.
          if (req.method === 'GET' && (url === '/' || url === '')) {
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end(fs.readFileSync(HTML_FILE, 'utf8'));
            return;
          }

          // List current projects.
          if (req.method === 'GET' && url === '/api/projects') {
            return sendJSON(res, 200, listProjects(readData()));
          }

          // Create one or more draft slots.
          if (req.method === 'POST' && url === '/api/projects') {
            const { items = [] } = await readBody(req);
            const rows = items.filter((it) => it && String(it.title || '').trim());
            if (!rows.length) return sendJSON(res, 400, { error: 'No titles provided.' });

            const data = readData();
            const taken = new Set([...data.work, ...data.lab].map((p) => p.slug));
            let nextNum = Math.max(0, ...data.work.map((p) => parseInt(p.num, 10) || 0));
            let nextCode = Math.max(0, ...data.lab.map((x) => parseInt(x.code, 10) || 0));

            const created = [];
            for (const it of rows) {
              const mode = it.mode === 'lab' ? 'lab' : 'work';
              const slug = uniqueSlug(slugify(it.title), taken);
              if (mode === 'lab') {
                const code = String(++nextCode).padStart(3, '0');
                const entry = makeLabDraft(it, slug, code);
                data.lab.push(entry);
                created.push({ mode, slug, title: entry.title, code });
              } else {
                const num = String(++nextNum).padStart(2, '0');
                const entry = makeWorkDraft(it, slug, num);
                data.work.push(entry);
                created.push({ mode, slug, title: entry.title, num });
              }
            }
            writeData(data);
            return sendJSON(res, 200, { created, projects: listProjects(data) });
          }

          // Rename a draft's title (drafts only — never touch published projects).
          if (req.method === 'PATCH' && url.startsWith('/api/projects/')) {
            const slug = decodeURIComponent(url.slice('/api/projects/'.length));
            const { title } = await readBody(req);
            if (!String(title || '').trim())
              return sendJSON(res, 400, { error: 'Title required.' });
            const data = readData();
            const entry = [...data.work, ...data.lab].find((p) => p.slug === slug);
            if (!entry) return sendJSON(res, 404, { error: 'Not found.' });
            if (!entry.draft)
              return sendJSON(res, 403, { error: 'Only draft projects can be edited here.' });
            entry.title = String(title).trim();
            writeData(data);
            return sendJSON(res, 200, { projects: listProjects(data) });
          }

          // Delete a draft (safety: refuses to delete a published project).
          if (req.method === 'DELETE' && url.startsWith('/api/projects/')) {
            const slug = decodeURIComponent(url.slice('/api/projects/'.length));
            const data = readData();
            const inWork = data.work.find((p) => p.slug === slug);
            const inLab = data.lab.find((x) => x.slug === slug);
            const entry = inWork || inLab;
            if (!entry) return sendJSON(res, 404, { error: 'Not found.' });
            if (!entry.draft)
              return sendJSON(res, 403, { error: 'Only draft projects can be deleted here.' });
            if (inWork) data.work = data.work.filter((p) => p.slug !== slug);
            else data.lab = data.lab.filter((x) => x.slug !== slug);
            writeData(data);
            return sendJSON(res, 200, { projects: listProjects(data) });
          }

          // ── About portrait (src/media/about/) ──
          if (req.method === 'GET' && url === '/api/about-image') {
            return sendJSON(res, 200, portraitInfo());
          }
          if (req.method === 'POST' && url === '/api/about-image') {
            const { dataUrl, name = 'upload' } = await readBody(req);
            const m = String(dataUrl || '').match(
              /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/
            );
            if (!m)
              return sendJSON(res, 400, { error: 'Send a JPEG/PNG/WebP image as a data URL.' });
            const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
            const bytes = Buffer.from(m[2], 'base64');
            if (bytes.length > 40 * 1024 * 1024)
              return sendJSON(res, 400, { error: 'Image too large (max 40 MB).' });

            fs.mkdirSync(ABOUT_DIR, { recursive: true });
            // One portrait at a time: clear previous image(s) first.
            for (const f of fs.readdirSync(ABOUT_DIR))
              if (/\.(jpe?g|png|webp)$/i.test(f)) fs.unlinkSync(path.join(ABOUT_DIR, f));

            const tmp = path.join(ABOUT_DIR, `.tmp-${Date.now()}.${ext}`);
            fs.writeFileSync(tmp, bytes);
            try {
              optimizePortrait(tmp, ext);
            } finally {
              if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
            }
            return sendJSON(res, 200, { ...portraitInfo(), originalName: String(name) });
          }
          if (req.method === 'DELETE' && url === '/api/about-image') {
            if (fs.existsSync(ABOUT_DIR))
              for (const f of fs.readdirSync(ABOUT_DIR))
                if (/\.(jpe?g|png|webp)$/i.test(f)) fs.unlinkSync(path.join(ABOUT_DIR, f));
            return sendJSON(res, 200, portraitInfo());
          }

          // ── Team directory (people.json): name → social/website URL ──
          if (req.method === 'GET' && url === '/api/people') {
            return sendJSON(res, 200, readPeople());
          }
          if (req.method === 'PUT' && url === '/api/people') {
            const body = await readBody(req);
            const people = body.people;
            if (!people || typeof people !== 'object' || Array.isArray(people))
              return sendJSON(res, 400, { error: 'people must be an object of name → url.' });
            const clean = {};
            for (const [name, link] of Object.entries(people)) {
              const n = String(name).trim();
              if (n) clean[n] = String(link == null ? '' : link).trim();
            }
            const cur = readPeople();
            const owner = String(body.owner || cur.owner || '').trim();
            if (owner && !(owner in clean)) clean[owner] = cur.people?.[owner] || '';
            writePeople({ owner, people: clean });
            return sendJSON(res, 200, readPeople());
          }

          // ── Project credits (Work projects) ──
          if (
            req.method === 'PUT' &&
            url.startsWith('/api/projects/') &&
            url.endsWith('/credits')
          ) {
            const slug = decodeURIComponent(
              url.slice('/api/projects/'.length, -'/credits'.length)
            );
            const body = await readBody(req);
            const credits = Array.isArray(body.credits)
              ? body.credits.map((c) => String(c).trim()).filter(Boolean)
              : null;
            if (!credits) return sendJSON(res, 400, { error: 'credits must be an array.' });

            const data = readData();
            const entry = data.work.find((p) => p.slug === slug);
            if (!entry)
              return sendJSON(res, 404, { error: 'Work project not found for credits.' });
            entry.credits = credits;
            writeData(data);

            // Auto-register any newly credited names in the directory (blank URL)
            // so their social link can be filled in on the Team tab.
            const dir = readPeople();
            let added = 0;
            for (const c of credits)
              for (const name of namesFromCredit(c))
                if (!(name in dir.people)) {
                  dir.people[name] = '';
                  added += 1;
                }
            if (added) writePeople(dir);

            return sendJSON(res, 200, {
              projects: listProjects(data),
              people: dir.people,
              addedPeople: added,
            });
          }

          // ── Full record for the project editor ──
          if (req.method === 'GET' && /^\/api\/project\/[^/]+$/.test(url)) {
            const slug = decodeURIComponent(url.split('/')[3]);
            const data = readData();
            const entry =
              data.work.find((p) => p.slug === slug) || data.lab.find((x) => x.slug === slug);
            if (!entry) return sendJSON(res, 404, { error: 'Not found.' });
            return sendJSON(res, 200, { entry, media: mediaFor(slug) });
          }

          // ── Update project fields (allowlisted) + draft/featured toggles ──
          if (req.method === 'PUT' && /^\/api\/project\/[^/]+$/.test(url)) {
            const slug = decodeURIComponent(url.split('/')[3]);
            const patch = await readBody(req);
            const data = readData();
            const entry =
              data.work.find((p) => p.slug === slug) || data.lab.find((x) => x.slug === slug);
            if (!entry) return sendJSON(res, 404, { error: 'Not found.' });

            for (const k of EDITABLE) {
              if (k in patch) entry[k] = String(patch[k] ?? '').trim();
            }
            if ('year' in patch) {
              const y = parseInt(patch.year, 10);
              entry.year = Number.isFinite(y) && y > 1900 ? y : null;
            }
            if ('draft' in patch) {
              if (patch.draft) entry.draft = true;
              else delete entry.draft;
            }
            if ('featured' in patch) entry.featured = !!patch.featured;
            if (Array.isArray(patch.credits)) {
              entry.credits = patch.credits.map((c) => String(c).trim()).filter(Boolean);
              const dir2 = readPeople();
              let added2 = 0;
              for (const c of entry.credits)
                for (const name of namesFromCredit(c))
                  if (!(name in dir2.people)) {
                    dir2.people[name] = '';
                    added2 += 1;
                  }
              if (added2) writePeople(dir2);
            }
            writeData(data);
            return sendJSON(res, 200, { entry, media: mediaFor(slug), projects: listProjects(data) });
          }

          // ── Project media: list / upload / delete / set hero ──
          if (req.method === 'GET' && /^\/api\/project\/[^/]+\/media$/.test(url)) {
            return sendJSON(res, 200, { media: mediaFor(decodeURIComponent(url.split('/')[3])) });
          }

          if (req.method === 'POST' && /^\/api\/project\/[^/]+\/media$/.test(url)) {
            const slug = decodeURIComponent(url.split('/')[3]);
            const { files = [] } = await readBody(req);
            if (!files.length) return sendJSON(res, 400, { error: 'No files sent.' });

            const dir = path.join(PROJECT_MEDIA, slug);
            fs.mkdirSync(dir, { recursive: true });
            const saved = [];
            for (const f of files) {
              const m = String(f.dataUrl || '').match(
                /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/
              );
              if (!m) continue;
              const srcExt = m[1] === 'jpeg' ? 'jpg' : m[1];
              const bytes = Buffer.from(m[2], 'base64');
              if (bytes.length > 60 * 1024 * 1024) continue;
              const tmp = path.join(dir, `.tmp-${Date.now()}-${saved.length}.${srcExt}`);
              fs.writeFileSync(tmp, bytes);
              // GIFs keep their frames; everything else is optimized to JPEG.
              const out =
                srcExt === 'gif'
                  ? path.join(dir, nextMediaName(dir, 'gif'))
                  : path.join(dir, nextMediaName(dir, 'jpg'));
              if (srcExt === 'gif') fs.copyFileSync(tmp, out);
              else optimizeInto(tmp, out);
              fs.unlinkSync(tmp);
              saved.push(path.basename(out));
            }
            return sendJSON(res, 200, { saved, media: mediaFor(slug) });
          }

          if (req.method === 'DELETE' && /^\/api\/project\/[^/]+\/media\/[^/]+$/.test(url)) {
            const parts = url.split('/');
            const slug = decodeURIComponent(parts[3]);
            const file = decodeURIComponent(parts[5]);
            if (!IMG_RE.test(file) || file.includes('..'))
              return sendJSON(res, 400, { error: 'Bad filename.' });
            const target = path.join(PROJECT_MEDIA, slug, file);
            if (fs.existsSync(target)) fs.unlinkSync(target);
            // Clear the designated hero if it pointed at the deleted file.
            const data = readData();
            const entry = data.work.find((p) => p.slug === slug);
            if (entry && entry.image && entry.image.split('/').pop() === file) {
              entry.image = '';
              writeData(data);
            }
            return sendJSON(res, 200, { media: mediaFor(slug) });
          }

          // ── Display order ──
          // The masonry's default "Index" sort has no comparator, so it renders
          // data.work in array order. Reordering that array here therefore
          // controls the live running order; `num` is renumbered to match so the
          // printed index reads 01…N.
          if (req.method === 'PUT' && url === '/api/order') {
            const { slugs = [], renumber = true } = await readBody(req);
            if (!Array.isArray(slugs) || !slugs.length)
              return sendJSON(res, 400, { error: 'slugs must be a non-empty array.' });

            const data = readData();
            const pool = new Map(data.work.map((p) => [p.slug, p]));
            const ordered = [];
            for (const s of slugs) {
              const p = pool.get(s);
              if (p) {
                ordered.push(p);
                pool.delete(s);
              }
            }
            // Anything the client didn't send keeps its original relative order.
            for (const p of data.work) if (pool.has(p.slug)) ordered.push(p);

            data.work = ordered;
            if (renumber)
              ordered.forEach((p, i) => {
                p.num = String(i + 1).padStart(2, '0');
              });
            writeData(data);
            return sendJSON(res, 200, { projects: listProjects(data) });
          }

          // ── Design settings ──
          if (req.method === 'GET' && url === '/api/design') {
            return sendJSON(res, 200, readDesign());
          }
          if (req.method === 'PUT' && url === '/api/design') {
            const patch = await readBody(req);
            const cur = readDesign();
            const num = (v, lo, hi, dflt) => {
              const n = Number(v);
              return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
            };
            const next = {
              accent: /^#[0-9a-f]{6}$/i.test(patch.accent || '') ? patch.accent : cur.accent,
              bg: /^#[0-9a-f]{6}$/i.test(patch.bg || '') ? patch.bg : cur.bg,
              columns: Math.round(num(patch.columns, 2, 4, cur.columns)),
              marqueeSpeed: Math.round(num(patch.marqueeSpeed, 10, 120, cur.marqueeSpeed)),
              fuiOpacity: num(patch.fuiOpacity, 0, 0.4, cur.fuiOpacity),
              fuiGlow: !!patch.fuiGlow,
              introLoader: !!patch.introLoader,
              cardHoverZoom: !!patch.cardHoverZoom,
            };
            writeDesign(next);
            return sendJSON(res, 200, next);
          }

          next();
        } catch (err) {
          sendJSON(res, 500, { error: String(err?.message || err) });
        }
      });
    },
  };
}
