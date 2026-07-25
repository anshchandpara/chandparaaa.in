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
const ABOUT_DIR = path.resolve(__dirname, '../src/media/about');
const HTML_FILE = path.resolve(__dirname, './admin.html');

// Match the repo convention: 2-space indent, unicode preserved, trailing newline.
const writeJSON = (file, d) => fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeData = (d) => writeJSON(DATA_FILE, d);
const readPeople = () => JSON.parse(fs.readFileSync(PEOPLE_FILE, 'utf8'));
const writePeople = (d) => writeJSON(PEOPLE_FILE, d);

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

// Lightweight list for the form UI (title, draft flag, and credits for editing).
const listProjects = (data) => ({
  work: data.work.map((p) => ({
    slug: p.slug,
    title: p.title,
    num: p.num,
    draft: !!p.draft,
    credits: p.credits || [],
  })),
  lab: data.lab.map((x) => ({ slug: x.slug, title: x.title, code: x.code, draft: !!x.draft })),
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

          next();
        } catch (err) {
          sendJSON(res, 500, { error: String(err?.message || err) });
        }
      });
    },
  };
}
