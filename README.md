# Ansh Chandpara — Portfolio

Cinematic, editorial portfolio site for **Ansh Chandpara — Creative Director · Title Designer · Filmmaker**, recreated in **React + Vite** from the design handoff.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run dev:lan  # same, on your local network (test on a phone)
npm run build    # production build → dist/
npm run preview  # preview the build
```

## Publishing (local first, then live)

The site is live at **[chandparaaa.in](https://chandparaaa.in)** via GitHub Pages. Work happens
on the **`dev`** branch, which never deploys; **`main`** is the live branch.

```bash
npm run status   # what's on your machine vs. what's live
npm run ship     # validate the build, then publish dev → main → live
```

`npm run ship` only publishes if `npm run build` succeeds, so a broken build can't reach the
live site. Pass a message to control the commit text: `npm run ship "Reworked hero timing"`.
Deploys take ~40s; the script waits and reports when the site is live.

> Requires Node 18+. This repo was set up with Node 22 LTS.

## Status

Home + Project detail pages are feature-complete against the handoff:

- [x] Project scaffold (Vite, design tokens, fonts, global CSS)
- [x] Custom cursor (dot + trailing ring, accent grow on `[data-cursor]`)
- [x] Magnetic links hook (`[data-magnetic]`)
- [x] Fixed nav with Work/Lab toggle, scroll state, `localStorage` persistence
- [x] Hero — wordmark mask reveal, Work/Lab media + copy swap, CTA, scroll cue
- [x] Selected Work asymmetric masonry (CSS columns 2–4, varying aspect ratios)
- [x] Three.js shader fallback for image-less cards (shared render ticker)
- [x] Card scroll reveal (ScrollTrigger.batch, linear, staggered)
- [x] Client / keyword grid (Work → clients, Lab → keywords)
- [x] About section (heading + body + stats)
- [x] Archive (all projects, grouped by year, mode-aware)
- [x] Contact (clip-mask headline reveal, email, socials)
- [x] Intro loader (counter 000→100, bar wipe, slide-up dismiss)
- [x] Project detail page (`?p=<slug>` routing, hero shader, metadata, brief, slots, credits, next)
- [x] Client-side routing (in-app links, no full reload)
- [x] Real imagery — 85 photos across 11 projects (hero thumbnails + galleries) from the
      Ansh-Chandpara-Website repo; image-less projects keep the shader fallback.
- [x] Hero background loop — self-hosted, optimized `public/hero-loop.mp4` + poster

## Conventions (from the handoff — intentional)

- **Motion is linear everywhere** (`ease: 'none'` / `--ease: linear`), durations 0.22–0.6s.
- **Native scroll** — no smooth-scroll interpolation.
- Per-project accent colors are used **only** for card thumbnails, never UI chrome.
- Display/wordmark: **Space Grotesk** 700. Body/UI: **Inter** 300/400/500.

## Structure

```
src/
  main.jsx                entry
  App.jsx                 router (Home vs Project) + global cursor
  styles/global.css       design tokens + base layer
  components/
    Home.jsx              home page (hero + Selected Work)
    AboutPage.jsx         about page (?page=about): About → Clients → Archive → Contact
    Footer.jsx            shared footer (Home + AboutPage)
    ProjectPage.jsx/.css  project detail page
    Cursor.jsx/.css       custom cursor
    Nav.jsx/.css          fixed nav + Work/Lab toggle
    Hero.jsx/.css         hero section
    Work.jsx/.css         Selected Work asymmetric masonry
    CardCanvas.jsx        Three.js shader panel (image-less card fallback)
    ProjectHeroCanvas.jsx Three.js shader panel for the project hero
    Clients.jsx/.css      platforms marquee (work) / keyword grid (lab)
    PlatformMarquee.jsx/.css  OTT logo marquee (home, below hero + About page)
    FuiGrid.jsx/.css      site-wide dim FUI grid backdrop w/ cursor glow
    About.jsx/.css        about section
    Archive.jsx/.css      archive list (grouped by year)
    Contact.jsx/.css      contact / footer headline
    Loader.jsx/.css       intro loader
  hooks/
    useMagnetic.js        magnetic hover
    useMode.js            Work/Lab mode state (localStorage-persisted, shared)
    useReveal.js          generic [data-rv] scroll reveal
    useRoute.js           ?p=<slug> / ?page=<name> routing + link interceptor
  lib/
    accents.js            per-project accent colors
    images.js             glob-enumerate real project imagery by slug
    workCards.js          derive featured cards (aspect ratios, meta)
    archive.js            build archive groups by year/mode
    projectData.js        flatten + resolve a project by slug
    glTicker.js           shared rAF ticker for WebGL panels
  media/projects/<slug>/  real project photos (Vite-hashed at build)
  data/projects.json      project dataset (19 work + 2 lab)
```

## Imagery

Real photos live in `src/media/projects/<slug>/` (85 files, 11 projects), sourced from
[Ansh-Chandpara-Website](https://github.com/anshchandpara/Ansh-Chandpara-Website) and remapped
from its `assets/images/NN-<name>/` folders to our slugs. `src/lib/images.js` enumerates them via
`import.meta.glob`; the designated hero from `projects.json` (when present) is shown first and the
rest become the gallery. Projects without photos (e.g. Lootere, The Railway Men) keep the WebGL
shader panel. To add more, drop files into `src/media/projects/<slug>/`.

Source frames are usually huge (e.g. The Railway Men shipped 20 × ~10 MB 3.4K PNGs). Downscale +
convert before importing — e.g. `sips -s format jpeg -s formatOptions 82 -Z 2000 in.png --out out.jpg`
— and zero-pad sequential names (`001.jpg`, `002.jpg`…) so the gallery orders correctly.

**GIFs** are first-class here: drop a `.gif` into a project's media folder and it's treated like any
other still (hero thumbnail, masonry card, or gallery item) and animates natively in `<img>`. Name it
`001.gif` (or point `image` at it) to make it the animated hero/card. Keep GIFs small — they don't
re-compress, so a heavy loop will bloat the page; for anything longer than a couple seconds prefer a
Vimeo `video` (below).

## Project video (title sequences)

Every project has a `"video"` slot (empty by default) so each can lead with its title sequence as the
hero instead of a still. Upload the master to **Vimeo** (the 4K masters are far too big to self-host;
Vimeo is the rule for all video here), then add the numeric Vimeo ID to that project in `projects.json`:

```json
{ "slug": "the-railway-men", "video": "123456789", ... }
```

When `video` is set, a Vimeo player (accent-tinted, no Vimeo chrome) fills the 16:9 hero slot and the
stills become the gallery below; when empty, the first still is the hero. Make sure the Vimeo video
allows embedding (Settings → Privacy → "Where can this be embedded").

## Credits & collaborator links

Project credits live as strings in `projects.json` ("Role — Name1, Name2"). The credits block on
each project page parses them into a role + name layout. The collaborator directory lives in
**`src/data/people.json`** (`{ "owner": "...", "people": { "Name": "url", … } }`) and is re-exported
by `src/lib/people.js` (`OWNER`, `PEOPLE`, `parseCredit`). Give a name a URL and it becomes a link
(opens in a new tab) everywhere that name appears in credits; leave it `''` for plain text. The
`owner` is always highlighted in the accent color. Names must match the credit spelling exactly (a
few people appear under variant spellings — point each at the same URL).

You don't have to edit these files by hand: the **`/admin` form** (see below) has a *Team & social
links* editor (fill each person's URL, add/remove people) and a *Project credits* editor (pick a
Work project, edit its `Role — Names` lines). Names typed into credits autocomplete from the
directory, and any brand-new name is added to `people.json` automatically (blank URL) so you can
give it a link afterward.

> Note: `owner`'s link currently points at `instagram.com/chandparaaa` — update it to your real
> handle/site (via the /admin Team editor, or directly in `src/data/people.json`).

## Drafts & the authoring form

New projects can be scaffolded before their content exists. Any entry in `projects.json` with
`"draft": true` is **hidden from the live site** — it won't appear in the Selected Work masonry or
the Archive — while its detail page (`?p=<slug>`) still resolves so you can preview it, and the
"next project" link never points at a draft. Flip `draft` to `false` (or remove it) once images,
video and credits are in.

To create drafts without hand-editing JSON, run `npm run dev` and open
**`http://localhost:5173/admin`**. It's a small dev-only form: type a project title (Work or Lab),
optionally fill category/client/year/role/platform, and hit **Create drafts** — it writes valid
entries into `projects.json` (unique slug, next `num`/`code`, `featured:false`, `draft:true`, empty
content) and hot-reloads. You can also rename or delete existing drafts there; it refuses to modify
published projects. The tool is a Vite plugin (`tools/vite-admin-plugin.js` + `tools/admin.html`)
registered with `apply: 'serve'`, so it exists only in the dev server and never ships to `dist`.

The same page also hosts the **Team & social links** and **Project credits** editors described under
*Credits & collaborator links* above, plus an **About portrait** uploader — so titles, drafts, team
links, credits and your photo are all managed from one place.

**About portrait:** the About page shows your photo under the "A study in motion…" heading (4:5
crop, subtle grade). Upload it via `/admin` (auto-optimized with `sips` to a ≤2000px q82 JPEG at
`src/media/about/portrait.jpg`) or drop an image into `src/media/about/` manually. Remove it and
the section gracefully collapses back to text-only. `src/lib/aboutImage.js` is the loader.

## Location (live map)

The hero shows your current base as a text label (e.g. "Pune, India"); clicking it expands a live
dark Leaflet/CARTO mini-map with a pulsing pin and a ticking local-time readout (the map and its
tiles only load on first open; outside-click / Esc closes it). The footers print the same city. All
of it reads from one file, `src/lib/location.js`:

```js
export const CURRENT_LOCATION = {
  city: 'Pune', country: 'India',
  lat: 18.5204, lng: 73.8567,
  zoom: 11,              // ~9 regional, ~13 city
  tz: 'Asia/Kolkata',   // IANA tz drives the local-time readout
};
```

When you move, edit that object only — the map re-centers, the label + footer update, and the clock
follows the new timezone. Grab `lat`/`lng` by right-clicking a spot in Google Maps; find the IANA tz
name (e.g. `Asia/Dubai`, `Europe/London`) if it changes. The map needs no API key (OpenStreetMap
tiles via CARTO; attribution is shown as required).

## Hero background loop (self-hosted)

The Work-mode hero plays a short, muted, self-hosted loop — `public/hero-loop.mp4`, with
`public/hero-poster.jpg` as the first-paint still. It's a `<video autoplay muted loop playsinline>`
graded by CSS (`saturate/contrast/brightness`) under the veil. Lab mode uses a separate studio still.

To swap the loop: optimize the source down to ~1080p and a few MB, then replace the two files in
`/public` (keep the names). Masters are often 4K and huge — e.g. the current loop was transcoded from
a 46 MB 4K clip to 7.7 MB with:

```bash
ffmpeg -i in.mp4 -an -vf scale=1920:-2 -c:v libx264 -crf 26 -preset slow \
  -pix_fmt yuv420p -movflags +faststart hero-loop.mp4
ffmpeg -ss 1 -i in.mp4 -frames:v 1 -vf scale=1920:-2 -q:v 4 hero-poster.jpg
```

(This is the one video that's self-hosted rather than on Vimeo — a muted background loop needs to
autoplay inline and stay lightweight; project title sequences still go on Vimeo.)

Design references live in `../Website02/design_handoff_portfolio/` (`Portfolio.dc.html`,
`Project.dc.html`, `README.md`).
