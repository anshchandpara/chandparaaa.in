# CLAUDE.md — Ansh Chandpara Portfolio

Cinematic dark portfolio for **Ansh Chandpara — Director · Title Designer · Filmmaker**.
**React + Vite.** `README.md` is the authoritative reference for the file tree, design tokens, and
the imagery / video / credits / location systems — read it before making changes.

## Workflow: local first, then publish
**`dev` = working branch (default; never deploys). `main` = live.** Never commit design work
straight to `main`.
```bash
npm run dev       # localhost:5173 — iterate here
npm run dev:lan   # same, exposed on the LAN → check on your phone
npm run status    # what's local vs. live
npm run ship      # commit + validate build + dev→main→deploy (only when happy)
npm run ship "Reworked hero timing"   # with a custom commit message
```
`tools/ship.sh` refuses to run off `dev`, aborts if `npm run build` fails (so a broken build
can never reach the live site), pushes `dev` as backup, fast-forward merges into `main`,
returns you to `dev`, then polls the Actions run and prints the result. `tools/status.sh` shows
uncommitted files + unshipped commits.

## Deployment (live)
- **GitHub Pages** from public repo **`anshchandpara/chandparaaa.in`**; custom domain
  **chandparaaa.in** (`public/CNAME`), **HTTPS enforced** (Let's Encrypt cert issued for the
  apex). Deploys via `.github/workflows/deploy.yml` (Actions: npm ci → vite build →
  deploy-pages) on push to `main` only. Pages build_type=workflow; cname set via API.
- **Cert gotcha:** if the custom domain is attached before DNS resolves to GitHub, no cert is
  ever requested (`https_certificate: null`, serves the wildcard `*.github.io` cert). Fix =
  detach + re-attach the domain via API (`PUT /pages` with `cname:null`, then the domain
  again) — issuance starts immediately.
- **gh CLI** at `~/.local/bin/gh`, authed as `anshchandpara` (device flow; scopes
  repo/workflow/read:org). Git identity: Ansh Chandpara <anshchandpara@gmail.com>.
- **DNS (user-side, at registrar):** apex A → 185.199.108.153/.109/.110/.111, www CNAME →
  `anshchandpara.github.io`. As of 2026-07-25 the domain still pointed at registrar parking
  (15.197.148.33) — once switched, enable **Enforce HTTPS** (API: `PUT /pages
  -F https_enforced=true` after cert issues).

## Run
```bash
cd ansh-portfolio
npm run dev      # http://localhost:5173
npm run build    # validates everything; has been clean
```
Node is installed locally (no Homebrew/sudo): `~/.local/node`, symlinked onto `~/.local/bin`
(`node`/`npm`/`npx`). If `node` isn't found, that PATH entry is missing.

## Environment quirks (bitten repeatedly)
- **ffmpeg** = static binary at `/tmp/node_modules/ffmpeg-static/ffmpeg`
  (install: `cd /tmp && npm install ffmpeg-static`). `/tmp` clears on reboot → reinstall.
  No `ffprobe` — use `mdls` or ffmpeg `metadata=print` for video info.
- **`sips`** (macOS) for image resize/convert.
- **Shell is zsh; system bash is 3.2:**
  - zsh doesn't word-split `for x in $var` — use literal lists or `while read`.
  - no bash assoc arrays (`declare -A`); use `$((10#$n))` for zero-padded ints.

## Conventions / decisions
- **Project videos → Vimeo.** Each `projects.json` entry has a `"video"` field (numeric Vimeo ID)
  → embed hero above the stills. Agent can't upload; user provides IDs.
  Exception: the **hero background loop is self-hosted** (`public/hero-loop.mp4`, ~7.7 MB 1080p).
- **Self-hosted project hero loop:** drop a `hero.mp4` (muted, web-optimized) into
  `src/media/projects/<slug>/` and the project page leads with it as an autoplaying loop
  (`lib/heroVideo.js` → `getHeroVideo`; `.pd__hero-loop` in ProjectPage; Vimeo `video` still
  wins). Rendered **full-bleed** (`.pd__hero--bleed` = `100vw` + `calc(50% - 50vw)` breakout,
  `max-height:88vh`; the -7px seen in the preview pane is only its classic scrollbar — macOS
  overlay scrollbars make it a true 0). First use: monsoon-season-mixtape — the hand-painted-title **timelapse at 2× speed**
  (`ffmpeg -vf "setpts=0.5*PTS,scale=1920:-2,fps=25" -crf 28`, 30s → **1.8 MB** at 1080p; a GIF
  of the same would be 40–60 MB). Timelapses compress extremely well.
- **YouTube "Watch the film" link:** optional `"youtube"` field (full URL) on a work entry →
  `.pd__watch` CTA on the project page (opens in a new tab). Editable in the /admin project
  editor (`f-youtube`, in the EDITABLE allowlist). Hidden when empty.
- **Media pipeline:** optimize source frames to ~2000px JPEGs (`sips -s format jpeg
  -s formatOptions 82 -Z 2000 …`; only downscale, never upscale), name `001.jpg, 002.jpg …` in
  `src/media/projects/<slug>/`. `src/lib/images.js` globs them (jpg/png/webp/gif); first sorted (or
  the entry's designated `image` basename) = hero, rest = gallery. To pull stills from a video, use
  ffmpeg scene detection (`select='gt(scene,0.3)'`, lower if too few), grab a mid-shot frame per shot.
- **Edit `projects.json` via small Python scripts** with
  `json.dump(d, f, indent=2, ensure_ascii=False)` + trailing newline (preserves em-dashes/format).
- **Project facts** are mirrored from the user's `Website Master/cms.html` (`SEED_ENTRIES`).
- **Credits/collaborators:** `src/lib/people.js` maps name → URL (blank = plain text); the owner
  (Ansh) is always accent-highlighted. Credit strings are `"Role — Name1, Name2"` in `projects.json`.
- **Design language:** dark (`--bg #0a0a0a`), warm gold accent (`--accent #d98b2b`),
  Space Grotesk (display) + Inter (body). Source masters live OUTSIDE the repo at
  `…/iCloud Drive (Archive)/…/Website Master/` (`Titles CG/`, `MVs/`, `PVs/`, `Events /`, `Edit/`).

## Current design state (as of this session)
- Hero wordmark = **"Chandparaaa"** (per-letter scatter-in intro, "aaa" settles last; hover =
  colour-invert + glassy distortion + gravity sag). Custom cursor = **inverted triangle** + dot.
- Work masonry = **modular, responsive, infinite scroll**: every published project (19; drafts
  excluded). **Columns step 4 → 3 → 2 → 1** at 1440/1024/640px (`useColumns` in `Work.jsx`,
  rAF-throttled resize; `COLUMNS=4` in Home is the cap). Ratios are a modular set
  `['4/5','1/1','3/4','4/5','1/1']` — 5 steps, coprime with 3 and 4 so rows never sync up.
  Caption type + scrim scale down per density via `.work__grid[data-cols='3'|'4']`.
  **Sort control** in the section head (`SORTS` in `workCards.js`): Index (curated `num`
  order) / Newest / Oldest / A–Z / Type. Ratios are applied by *display position*
  (`withRatios`) so the modular rhythm survives any sort. Undated projects (raat-khatam,
  union-day-yas-mall, savi-bb, dico-battery have no `year`) always sort **last** in both
  year directions — never "oldest". Re-sorting keeps the loaded card count; every card
  remounts (losing their reveal flag), so the reveal re-runs for all of them.
- **Card reveal is a plain rAF-throttled scroll position check** (`Work.jsx`), deliberately
  NOT ScrollTrigger and NOT IntersectionObserver. Both only react to a *crossing*: a card that
  goes from below the fold to above it in one jump — fast scroll, anchor jump, re-sort,
  appended batch, column change — never crosses and stayed **permanently invisible** (this was
  the "cards aren't loading" bug). The check simply reveals anything with
  `top < innerHeight * 0.92`, however it got there; cards are flagged `data-fr-done` and the
  listener detaches once nothing is pending. Note a full re-sort restaggers 19 cards
  (0.05 stagger) so it takes ~600ms to finish — mid-stagger snapshots look like stuck cards
  but aren't; always re-measure after ≥1s.
  First 8 cards, then +`cols*2` per IntersectionObserver sentinel (700px rootMargin). Layout is
  **fixed round-robin flex columns** (`.work__col`, `i % cols`) — NOT CSS multicolumn, which
  rebalances/reshuffles on append. Reveal batches register per-append (`data-fr-init` guard;
  triggers killed only on unmount). Still full-bleed, zero-gutter, captions overlaid. Foot
  link relabelled "Archive" → about-page archive. `featured` flags no longer drive the grid
  (still in data, unused).
- **Card treatment (frosted glass → clear on hover):** each `.fcard` shows its image always
  present but **blurred** (`.fcard__img` `filter: blur(18px) saturate brightness(.82)`, scaled
  1.14 to hide blur edges) under a **frosted pane** (`.fcard__glass` — glassy white sheen +
  inset top highlight, darkening to the base for title legibility, light `backdrop-filter:
  saturate`). `num` + big `fcard__title` sit on the glass. On hover/focus-visible: glass
  opacity→0, image filter→none + settle zoom, `fcard__cover` fades out, and `fcard__scrim` +
  small `fcard__caption` fade in. Image-less cards frost the `CardCanvas` shader (`.fcard__gl`)
  the same way. Two title elements (big cover + small caption) for the cross-fade. Titles scale
  down at `[data-cols='3'|'4']`. (Superseded the earlier dark-tile text index.)
- **Two-page IA (July 2026 split):** Home = Hero (loop) + Selected Work masonry + footer only.
  **About is its own page at `?page=about`**: About (01) → Clients → Archive (02) → Contact
  (`id="contact"` kept, `AboutContact` named export in `About.jsx`). Routing extended in
  `useRoute.js` (returns `{slug, page}`; intercepts `?page=` links). Nav = Projects (`./#work`) +
  About (`?page=about`); masonry "All work" → `?page=about#archive`. Shared `Footer.jsx` +
  `useMode.js` (Work/Lab persisted). **Route fade** = `.page-fade` keyed wrapper in `App.jsx`
  (opacity-only — transform would break the fixed nav). **Loader plays once per session**
  (`sessionStorage acIntroPlayed`). Lab-mode home is just the hero (masonry is work-only).
  About-page "Projects" stat counts published (non-draft) work only.
- **Lab-mode hero cover** = Ansh's own ornamental pencil drawing
  (`src/media/lab/lab-cover.jpg`, imported in `Hero.jsx` as `LAB_IMG`) — **replaced the stock
  Unsplash studio photo**; no stock imagery remains anywhere in `src/`. Styled
  `.hero__media--art`: `object-fit: contain` (the scan is already matted on black, so the torn
  deckle edges float seamlessly on the page bg) + `brightness(.78)` — dimmed far less than the
  photo treatment so the pencil linework survives under the veil. Source:
  `Downloads/Texturelabs_Paper_368L.jpg` (4240×3239 → 2400px, 1.1 MB).
- Location = collapsible "Pune, India" chip → Leaflet/CARTO mini-map (`src/lib/location.js`).
- 19 work projects; 11 featured (incl. `ekam`, new `dico-battery`). Product Films was deleted.
- **Brand strings:** nav brand (both navs) = **"Ansh Chandpara"** (user reverted it from the
  earlier "Chandparaaa" unification). Footers + intro loader still say "Chandparaaa". Full
  legal name in About bio prose, `<title>`/meta SEO, `people.js` OWNER + credit strings.
- About stats: **Projects is now data-driven** (`data.work.length` → "19"); Years (06) /
  Platforms (07) remain curated editorial figures.
- **Platform logo marquee:** the About-page Clients band (Work mode) is now `PlatformMarquee.jsx`
  — a full-bleed strip of 11 OTT logo **marks with backgrounds removed** (transparent PNGs,
  cut from the brand cards via a flood-fill matte script — Pillow, adaptive-tolerance BFS from
  the borders, 1px decontamination erode; amazon-minitv's black text remapped to white for the
  dark bg). 42s linear infinite, duplicated aria-hidden strip translated -50% for a seamless
  loop (strip `padding-right` must equal its `gap`), pause on hover, ghost-grey base
  (`grayscale + brightness(1.5), opacity .75`) → brand colour on hover, edge fade via mask.
  Assets in `src/media/platforms/` (masters in Website Master `21_About_Page/`), data in
  `src/lib/platforms.js`. Lab mode keeps the keyword grid; the 5-name CLIENTS text list was
  removed as redundant. **The marquee also renders on Home between the hero and Selected Work**
  (work mode only) — so it appears on both pages. `21_About_Page` also holds a 1400×1750
  flower photo — a candidate About portrait, not yet used.
- **Text hover effects:** (1) Project-page titles (`.pd__title`) get chromatic aberration
  (red/cyan `text-shadow` fringes at ±0.035em via `.is-ab` class) + glassy distortion on hover
  — own SVG filter `#pd-glass`/`#pd-turb`/`#pd-disp` in ProjectPage.jsx, GSAP animates disp
  scale 0→5 with baseFrequency wobble, mirroring the hero wordmark pattern; filter lives on
  `.pd__title-line` (the h1 clips overflow for the rise animation). Mouse-only; reduced motion
  keeps static fringes, no warp. (2) Site-wide subtle glow on regular text hover
  (global.css `@media (hover:hover)` block): p/li/dt/dd/h2/h3/a/button/summary/.eyebrow/.foot
  span get `text-shadow: 0 0 .55em color-mix(currentColor 45%)` — glow inherits each
  element's colour. Big display headers excluded (own treatments). NB: elements with
  higher-specificity `transition` rules (e.g. `.nav__links a`) glow instantly instead of
  fading — the low-specificity global `transition: text-shadow` loses there; accepted.
- **FUI grid backdrop (`FuiGrid.jsx/.css`):** site-wide fixed layer, first child in `App` so all
  content paints over it. SVG data-URI tile (256px major cell, 64px minor lines, centre "+"),
  near-invisible white base (~8.5% layer opacity) + an accent-gold copy revealed through a
  260px radial `mask-image` that follows the cursor (`--fui-x/--fui-y`, rAF-throttled
  mousemove, parks off-screen on mouseleave / touch devices). Compositor-only — no layout work.
- **A/B compare slider (`Compare.jsx/.css` + `lib/compares.js`):** before/after VFX reveal on
  project pages. Drop frame-matched passes into `src/media/projects/<slug>/compare/` named
  `NN-clean.<ext>` (plate) + `NN-final.<ext>` (composite) — **stills (jpg/png/webp) OR loop
  videos (mp4/webm)**. Sub-folder so `images.js` (globs one level deep) leaves them out of the
  gallery. `getCompares(slug)` pairs them + flags `video`. ProjectPage renders a "Plate → Final"
  section (between brief + gallery). Slider = composite base + clean plate clipped via
  `clip-path: inset(0 (100-pos)% 0 0)`, gold handle, pointer-drag + click + ←/→ keys,
  `touch-action:none`. **Video pairs**: two muted/loop/playsinline `<video>`s kept in lockstep
  (composite is the timing master; a `timeupdate` handler pulls the plate's `currentTime` back if
  drift > 0.05s) so footage matches across the seam. reduced-motion → no autoplay (static first
  frame). **Passes MUST be frame-synced** — encode both from the same `-ss/-t` window at the same
  fps. First use: monsoon-season-mixtape — 2 video sliders (Title MONSOON SEASON reveal + Side
  Tings), 1080p H.264 loops (~3–4MB each, ~13MB total, page-scoped) from `Downloads/for ansh/`
  `_Without BG` / `_only BG` clean plates vs composites.
- **Lightbox (`Lightbox.jsx/.css`):** every still is clickable → full-screen carousel at native
  res (the ≤2000px optimized assets ARE the full-res files; no separate thumb pipeline).
  Wired on the project-page hero img + gallery frames (page-order list, hero offset handled;
  video-hero pages list gallery only) and the About portrait (single image). Esc / ←→ keys,
  edge arrow buttons (hidden ≤640px — swipe instead), pointer-swipe, veil-click close, body
  scroll lock, neighbour preload, `data-cursor-label="Expand"` on triggers, counter
  `NN / NN` with accent slash. z-index 90 (nav is 50). **Filmstrip:** thumbnail strip above
  the counter (64×40 cover crops, 0.4 opacity → 1 on active, hover 0.8); the active thumb
  gets an accent border + soft gold glow (double box-shadow) and auto-centres via smooth
  `scrollTo` (instant under reduced-motion; appears frozen in headless rAF — fine in real
  browsers). Click a thumb to jump; strip pointer events stopPropagation so dragging it
  never triggers the swipe-nav.
- **Draft projects:** entries with `"draft": true` are hidden from the masonry (`workCards.js`)
  and the archive (`archive.js`), but their `?p=<slug>` page still resolves for preview
  (`projectData.js` — `getAllProjects({includeDrafts})`; "next" never links to a draft). Use for
  scaffolded projects whose content (images/video/credits) isn't ready yet.
- **Collaborator directory moved to data:** `src/lib/people.js` now re-exports `OWNER`/`PEOPLE`
  from **`src/data/people.json`** (`{owner, people:{name→url}}`) + keeps `parseCredit`. A name
  with a non-empty URL already renders as a `target="_blank"` link in project-page credits
  (`ProjectPage.jsx`); the JSON just makes the directory editable by the /admin form.
- **Studio hub (dev-only):** `http://localhost:5173/admin` — Vite plugin (`apply:'serve'`) in
  `tools/vite-admin-plugin.js` + `tools/admin.html`; never ships to `dist`; needs `npm run dev`.
  **Three tabs:**
  - **Projects** — grid of every project (cover thumb + live/draft dot). Click one to open the
    full editor: title, subtitle, category, client, year, platform, role, Vimeo id, description,
    credits (with autocomplete + auto-registration of new names), draft/featured toggles, and an
    **image manager** (drag-drop or click upload → auto `sips` optimize to ≤2000px q82 JPEG and
    sequential `NNN.jpg` naming; set any image as cover; delete — clears `image` if it pointed
    there). Plus the create-drafts rows.
  - **Team** — name → URL directory (`people.json`).
  - **Design** — writes `src/data/design.json` (see below) + the About portrait uploader.
  API: `GET/PUT /admin/api/project/:slug`, `GET/POST /admin/api/project/:slug/media`,
  `DELETE …/media/:file`, `GET/PUT /admin/api/design`, plus the older projects/people/credits
  /about-image routes.
- **Design settings (`src/data/design.json` + `src/lib/design.js`):** accent, bg, columns (2–4
  cap), marqueeSpeed, fuiOpacity, fuiGlow, introLoader, cardHoverZoom. `applyDesign()` runs in
  `main.jsx` and pushes `--accent`, `--bg`, `--fui-opacity`, `--card-zoom` onto `:root`; the
  rest are read by `Home` (columns, loader), `PlatformMarquee` (speed), `FuiGrid` (glow).
  Server clamps every value on PUT. Defaults live in `design.js`, not the JSON.
  Legacy note — the older four areas, all writing straight into the data files:
  - **New slots / Drafts:** create draft projects by title (+ optional meta, Work or Lab) →
    `projects.json` with unique slug, next `num`/`code`, `featured:false`, `draft:true`, empty
    content. List/rename/delete drafts; refuses to touch published projects.
  - **Team & social links:** edit each person's URL, add/remove people → `people.json`
    (owner can't be removed).
  - **Project credits:** pick a Work project, edit `Role — Names` lines → `projects.json`
    `credits[]`. Names autocomplete from the directory; any new name is auto-added to
    `people.json` (blank URL) so its link can be filled in. Credits are allowed on published
    projects too (only the `credits` array is touched).
  - **About portrait:** upload a photo → optimized via `sips` (JPEG q82, ≤2000px, never
    upscales) into `src/media/about/portrait.jpg`. `src/lib/aboutImage.js` globs that dir;
    `About.jsx` shows it under the heading (`.about__portrait`, 4:5 crop, subtle desaturate
    grade that lifts on hover) and collapses to text-only when absent. One portrait at a time
    (upload clears the dir first); Remove deletes it. Can also just drop a file in that folder.
- **Render Studio (dev-only):** `http://localhost:5173/render` — Vite plugin (`apply:'serve'`) in
  `tools/vite-render-plugin.js` + `tools/render.html`; never ships to `dist`; needs `npm run dev`.
  A **Claude-in-the-loop** pipeline to turn grayscale source into high-res Higgsfield renders — the
  plugin only stages files + a job queue, it never calls Higgsfield. Working dir
  `tools/render-studio/` (gitignored: `manifest.json` + `uploads/`, `styleframes/`, `renders/`).
  Per **shot**: **Stage 1** upload a grayscale still (optimized to ≤2048px q90 JPEG via `sips`),
  write a **brief** (the user's own words — the user speaks, Claude does the prompting) →
  *✦ Enhance prompt* sets `promptJob='queued'`; Claude writes the **engineered prompt** and a
  **look lock** (3–6 canonical tokens, e.g. `amber key / teal shadows / 35mm grain`). A client-side
  **checker** lints the prompt live (chips: palette/lighting/film-texture/mood/source-adherence
  coverage; contradictions — mono terms, photoreal-vs-stylised, day+night, unplaced warm+cool;
  **look drift** = lock tokens missing, matched word-wise so "35mm grain" ⊂ "Kodak 35mm film grain").
  *Generate styleframes* sets `styleframeJob='queued'`. **Stage 2** (unlocks once a styleframe is
  *approved*) upload the grayscale `mp4` → *Queue render* sets `renderJob='queued'` snapshotting
  the lock — approved frame + look lock are the adherence contract. UI polls `/render/api/state`
  (file URLs use mtime cache-busters — don't switch to `Date.now()`, it makes every snapshot unique
  and the UI re-renders every tick). Uploads go through **`POST …/upload-raw?kind=&name=`** (raw
  bytes streamed to disk, 2 GB cap) — never the base64/JSON route for video: data-URL-encoding a
  real mp4 exceeds browser string limits ("failed to execute fetch").
  **How Claude fulfils jobs:** GET `/render/api/jobs` (prompt jobs first; entries carry brief,
  prompt, lookLock, media URLs) → set running via POST `/render/api/shots/:id/job` `{kind,status}`
  (`kind: 'prompt'|'styleframe'|'render'`) →
  - `prompt`: read brief + still, write a cinematic engineered prompt (palette, lighting, film
    texture, mood, + explicit source-adherence directive — *"preserve the exact composition/motion
    of the grayscale source"*; avoid unqualified mono terms), extract look-lock tokens → POST
    `/render/api/shots/:id/prompt-result` `{enhancedPrompt, lookLock[], note}`.
  - `styleframe`: Higgsfield `generate_image` from the still + engineered prompt (keep lock tokens
    verbatim) → POST `/render/api/shots/:id/ingest` `{kind:'styleframe', url|dataUrl, model, note}`.
  - `render`: styleframe-guided `generate_video` from approved frame + grayscale mp4 + prompt with
    lock tokens verbatim → ingest `{kind:'render', …}` (ingest auto-sets the job `done`).
  Files served at `/render/files/<relpath>`. Trigger phrase: user says **“run the render queue.”**
  **Segments (per-part look anchors):** each shot has `segments[]` — `{id, label, tStart, tEnd,
  element, styleframeId, tweaks}` — edited in Stage 2 (grid rows, silent blur-save via
  `saveFieldSilent` to preserve focus; PATCH accepts `segments`). `element` is a **Higgsfield
  reference element** name or UUID from the user's account (list via MCP `show_reference_elements`;
  embed as `<<<element_id>>>` inside the generation prompt — backend auto-injects the image; works
  on `seedance_2_0`, `kling3_0`, nano/cinema models). `styleframeId` anchors to a gallery frame
  instead. Queue-render allows: approved styleframe OR every segment anchored; renderJob snapshots
  `segments`. **Segmented render runner:** ffmpeg split source mp4 per `[tStart,tEnd]` → per
  segment `higgsfield generate create seedance_2_0 --video <segment.mp4> --start-image <anchor>`
  (or `<<<element>>>` in prompt) + engineered prompt + lock tokens + segment tweaks + "follow the
  source's camera motion exactly", duration ≈ segment length (4–15s int) → ffmpeg concat → ingest
  final. **ffmpeg is NOT installed** (as of 2026-07-06) — ask the user to `brew install ffmpeg`
  before running a segmented render. Higgsfield CLI is installed (`~/.local/bin/higgsfield`,
  workspace "Private" selected); CLI media flags take local file paths directly.

## Pending / next tasks
1. ~~Tivvra stills~~ **DONE** (8 frames from `Tiivra_AE2.0_v1.mp4` lead as `001…008.jpg`;
   `image` field cleared so 001 is hero). ~~savi-bb / union-day stills~~ **DONE** (extracted
   from `Events /SAVI_BB_v7.mp4` — no hard cuts, evenly sampled — and
   `Events /Yas mall_Union Day_v2.mp4` via scene detection). **Every featured masonry card now
   has real imagery** (171 stills / 18 projects). Extractor: scene-detect → mid-shot frames →
   ≤2000px q3 JPEG (script pattern in session scratchpads; matches README pipeline).
2. **icc-womens-t20-2024 stills:** no video/image master found anywhere in Website Master
   (only a CoWork HTML page) — needs media from the user.
3. **Vimeo IDs** pending from user for title sequences, the Tivvra/Dico/Raat-Khatam films, showreel.
4. **T7 drive (`/Volumes/T7/_Projects Archive 21-23/`)** — 2021-23 project archive. Imported as
   drafts (2026-07-26): `kyra-itc-farmlite` (4), `storm-plus` (7), `tasc` (8) from each
   project's curated `_STILLS`/`_Stills`/`_stills` folder. **Client / role / credits are blank
   and years are inferred from file mtimes — user must confirm before publishing.** Note
   `KYRA X ITC/_STILLS/KYRA_Static.png` has a Redshift render-stats bar burned into the
   bottom — excluded; the `BUGFIX_v*` renders are clean.
   Still on the drive, unimported: **InvisibleWoman** (title sequence, `SE01.mp4` + curated
   `IW_stills for insta`), **LML Electric** (`LML_MAIN FILM.mp4` 482MB), **Ultrahuman**
   (`RingInternalForming.mp4`), Boat, Shark Tank, Wave Boss, House Of Brands (someone else's
   masters film), KYRA X BudX, Tonic Studios, Decoupled, Archive_2019-2021.
5. **Draft content:** ~~Monsoon Season~~ **DONE** (2026-07: 11 stills from
   `Downloads/for ansh/` — Title_H.264 + Do Not Jump + 2 sky-fall PNGs → monsoon-season-mixtape;
   meta = Hanumankind / Title Sequence / 2025 / YouTube; still draft). That folder also holds the
   composited title films (`Title_H.264.mp4` 4K/33s, `Do Not Jump` 5120×2700, `Side Tings` 1080)
   **+ element passes** (`_Without BG`, `_text Only`, `_only BG`) — candidates for a Vimeo embed.
   Still not imported: `MVs/hASHISHBHAI` → hashishbhai-dhanji-rasla draft; `_BTS/*.mp4` (8 clips)
   → bts-captures lab item; `Edit/Showreel2023…` + Reel Edit 2026 → reel-edit-2026 lab item.
   varun-grover-comedy-special draft: no master found yet.
6. Optional: fill collaborator URLs in `people.js`; shrink the hero loop to ~4–5 MB
   (re-encode from the iCloud master, not the optimized copy). Newer loop masters exist at
   `Edit/Website Home Loop 02/03.mp4` — ask user which they want.
7. Dead code: `src/components/Contact.jsx` + `Contact.css` are orphaned (Contact was folded
   into About; not imported anywhere). Safe to delete when convenient.

## Preview/verification gotchas (headless browser)
- rAF is throttled → GSAP intros, WebGL card shaders, the hero `<video>`, and CSS transitions
  freeze mid-state. **Verify via DOM (`preview_eval`) more than screenshots.**
- **The preview pane is often `document.hidden === true`** (backgrounded), which *pauses* rAF
  entirely — GSAP tweens never advance, so elements read `opacity: 0` forever and look like a
  bug. Check `document.visibilityState` before trusting any tween-dependent measurement;
  prefer asserting end-states set with `gsap.set` over ones reached by `gsap.to`.
- Screenshots reset scroll to top; hide above-fold sections via `preview_eval` to capture below-fold,
  and force-reveal `[data-rv]`/`[data-fcard]` (`opacity:1; transform:none`).
- The SPA route **drifts** to a project page between tool calls; set `location.href = origin + '/'`
  and re-check `location.search` before asserting state.
- `console_logs` keeps a **stale buffer** across reloads — trust a fresh `npm run build` over it.
