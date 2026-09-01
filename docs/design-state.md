# Design state — architecture reference

Moved out of `CLAUDE.md` on 2026-08-09. This is the deep reference for how the site
actually behaves: the hero, the masonry, the landing gate, the page systems, and the
Studio/Render dev tooling. **Read on demand**, not every session.

Owner boundaries: `README.md` owns structure, design tokens and the data-layer contract.
`CLAUDE.md` owns the workflow rails and conventions. `HANDOFF.md` owns what is true right
now. This file owns how the built things work.

---

- **Hero wordmark = "Chandparaaa" — glitch decode + cursor-driven glitch (2026-08).**
  The old per-letter *positional scatter* was **removed**: the wordmark now holds position and
  **decodes in place** from random special characters, the trailing "aaa" resolving last (that
  rhythm survived the change via `scrambleLetters`' `order` argument). Nothing in the reveal may
  touch x/y/rotation — opacity only, or it's a scatter again.
  - **The glitch is LOCAL (2026-08-08).** There is no word-wide intensity any more: `Hero.jsx`
    writes a per-letter **`--g`** (0→1) on each `.hero__letter` from *that letter's own* distance
    to the cursor, falling to 0 at **`RADIUS` 150px**. Only the pocket under the pointer glitches
    and inverts — measured with the cursor on the first letter: `C` 0.99 → `h` 0.76 → `a` 0.52 →
    `n` 0.28 → `d` 0.04 → the remaining six letters exactly 0.
    - Letter centres are **cached relative to the word**; measuring 11 rects per frame would
      force a synchronous layout on every mousemove. Each frame reads one rect (the word) and
      does maths. Re-measured on resize, **and once after `readyRef`** — glyphs aren't the same
      width as the real letters, so centres taken mid-decode are wrong.
    - The ghost's offset/fade moved from the container to **per ghost letter**, or the whole
      word would slide as one.
    - **The SVG warp is deliberately not driven on hover any more** — a whole-word warp
      contradicts the locality. It now fires only as the reveal pulse, which also removes the
      per-frame `feDisplacementMap` write that was the page's main performance risk.
    - Caveat on "invert": it is `color:#fff` + `mix-blend-mode: difference` per letter. Since
      `.hero__word` carries `filter: url(#hero-glass)` (a stacking context), the blend group is
      the word itself, so against the dark loop the visible result is essentially bright white
      rather than a true inversion of the footage.
    The mousemove is rAF-throttled exactly like `FuiGrid.jsx`'s `--fui-x/y` — follow that
    pattern rather than adding a second one.
  - **Layers:** solid base + `.hero__ghost`, a **stroke-only** copy (`-webkit-text-stroke`,
    transparent fill, same `.hero__letter` class so metrics match exactly) that slides out of
    register per letter, + the per-letter invert past `HOT_AT` 0.5, + live character churn, which
    only picks from letters whose own `--g` > 0.35. Knockout-fill, RGB split and slice
    displacement were considered and deliberately left out.
  - **If the SVG warp is ever driven per-frame again, quantise it.** `feDisplacementMap` over
    type at `clamp(35px,7.25vw,110px)` is the most expensive thing on this page; rewriting the
    attribute every frame repaints the whole filter. Currently moot — hover doesn't touch it.
  - **The `<h1>` carries `aria-label="Chandparaaa"`.** Without it the heading's accessible name
    is whatever glyphs the decode/churn happen to be showing. The ghost is `aria-hidden` for the
    same reason (it lives inside the `<h1>`).
  - **The gravity sag is gone too** (removed 2026-08-08, with the scatter). The *base* letters
    never transform — the reveal is opacity-only and the churn is text-only; only the ghost
    letters move. So `.hero__letter` carries **no `will-change`**: promoting 22 spans for a
    transform most of them never do
    is pure cost. The ghost letters are the only things that move.
  - `readyRef` gates the churn until the decode resolves, or they fight over the same spans.
  Custom cursor = **inverted triangle** + dot.
- Work masonry = **modular, responsive, infinite scroll**: every published project (19; drafts
  excluded). **Columns step 4 → 3 → 2 → 1** at 1440/1024/640px (`useColumns` in `Work.jsx`,
  rAF-throttled resize; `COLUMNS=4` in Home is the cap). Ratios are a modular set
  `['4/5','21/9','1/1','3/4','21/9','4/5','1/1']` — **7 steps, coprime with 2/3/4 columns** so
  no two columns share a ratio sequence at any density; the two **21:9 letterbox** cards per
  cycle compact the columns and break the vertical rhythm (at 4-up: 360×154 vs 360×450 tall).
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
- **Card treatment (monotone frosted glass → colour on hover):** each `.fcard` shows its image
  always present but **blurred + fully desaturated** (`.fcard__img`
  `filter: blur(15px) grayscale(1) contrast(1.06) brightness(.86)` → hover
  `blur(0) grayscale(0) contrast(1) brightness(1)`, so the grid reads as a monochrome index and
  only the hovered card blooms into colour), scaled
  1.14 to hide blur edges) under a **frosted pane** (`.fcard__glass` — glassy white sheen +
  inset top highlight, darkening to the base for title legibility, light `backdrop-filter:
  saturate`). `num` + big `fcard__title` sit on the glass. On hover/focus-visible: glass
  opacity→0, image filter→none + settle zoom, `fcard__cover` fades out, and `fcard__scrim` +
  small `fcard__caption` fade in. Image-less cards frost the `CardCanvas` shader (`.fcard__gl`)
  the same way. Two title elements (big cover + small caption) for the cross-fade. Titles scale
  down at `[data-cols='3'|'4']`. (Superseded the earlier dark-tile text index.)
- **Landing gate (`Landing.jsx/.css`, 2026-08):** the front door. Between the intro loader and
  Home: the hero loop at **35%** under the FUI grid in **`mix-blend-mode: difference`**.
  **Three rows, same `clamp(20px,4vw,72px)` padding as the loader** so the brand lands on the
  loader's own baseline behind it: brand (13px) pinned to the **top** margin, role eyebrow (10px)
  to the **bottom**, and the **Work · Lab panel** centred in the slack between them
  (`.landing__mid { flex: 1 }` — optically centred between the anchors, ~2px off raw viewport
  centre because the brand and role rows differ in height).
  **Split 50/50, each choice previewing its own world:** the site hero loop behind Work, the
  **Monsoon Season title timelapse** behind Lab (via the existing `getHeroVideo(
  'monsoon-season-mixtape')` glob — no new import). Grid and veil stay single full-width layers
  so the FUI grid runs unbroken across the seam, and `.landing__seam` continues the panel's
  hairline down the whole screen in the same `--line` token.
  - **The panel's separator must land exactly on the media seam** — that alignment is the whole
    reason for the layout, and it's why the split is static (a seam that moved on hover would
    break it). Hover is expressed by *lighting the half* instead: opacity `.35 → .55`,
    `grayscale(.45) → 0`.
  - **Two gotchas that cost real time getting that alignment right:**
    **(1)** "Work" is wider than "Lab", so a content-sized panel puts the separator ~7px off
    centre. `flex: 1 1 0` does **not** fix it — the panel is intrinsically sized, so there's no
    free space for `flex-grow` to distribute. **Grid `1fr 1fr` does**, because fr tracks equalise
    under intrinsic sizing. **(2)** `.landing__mid` is **absolutely centred on the gate**, not
    flowed between the brand and role rows — those differ in height (21px vs 16px), which threw
    the separator off by 6px once everything stacked on mobile. Both axes now measure 0.
  - **The two sources are wildly mismatched in luminance** — the hero loop is dark footage, the
    Monsoon timelapse is paint on *white paper*, which at the same opacity reads twice as bright
    and lets the Lab half dominate. `.landing__half--lab` carries `brightness(0.5)` (0.7 hot) to
    sit the pair level. Re-check this if either clip is ever swapped.
  The panel is a **small segmented control** (~182×39px): one pane of dark glass
  (`rgba(11,11,11,.5)` + `backdrop-filter: blur(18px)`), a `--line` hairline border, and the two
  choices split by a single `border-left` hairline — flat, no fills, in the site's own hairline
  language. Type is `clamp(13px,1.25vw,18px)` uppercase at `.16em` — deliberately **control
  scale, not display scale**; the tracking carries it rather than size. Choosing sets Work/Lab
  mode (the same `useMode` state the nav pills drive) and fades the gate out to reveal the Home
  already mounted behind it. ≤640px the panel stretches and the hairline turns horizontal.
  - **Layer order is load-bearing:** media → grid (difference) → veil → `.landing__stack`
    (z-index 1, *normal* blend). Put the grid above the stack and the type inverts into mush.
    `.landing` carries **`isolation: isolate`** so the blend can't reach the page behind it, and
    sits at **z-index 8000** — under the Loader (9000) so the loader's slide-up *reveals* it,
    over nav (50) / lightbox (90).
  - **The gate rides `acIntroPlayed`** — no second storage key. It shows only when the loader
    does: cold entry, once per session, and skipped under reduced motion or with `introLoader`
    off. Own toggle `landingGate` in /admin → Design.
  - **`Home.jsx` must decide `loader`/`gate` ONCE, in a lazy `useState` initializer** (the `entry`
    object). They were plain render-time expressions at first and it broke: the loader writes
    `acIntroPlayed` when it finishes → re-render → `introAlreadyPlayed()` now true → `showGate`
    flips false → **the gate is ripped off screen the instant the loader ends.** The old code got
    away with re-reading storage because `showLoader` was only ever paired with `!introDone`.
  - `Hero` gets `play={introDone && gateDone}` — the wordmark scatter must wait for the choice or
    it plays out unseen behind the gate and you arrive at an already-settled title.
  - **Breathing glow** = blurred accent radial on `.landing__choice::before`, animating
    opacity + transform only (never `box-shadow` spread — that repaints every frame). The Lab
    button carries `animation-delay: -1.8s`, a half-cycle offset so the two never pulse in
    lockstep. Hover/focus kills the animation and locks it at full rather than letting it drift.
    **This is the one easing exception on the site** (`ease-in-out`, not `--ease: linear`) — a
    linear breathe reads mechanical, like a blinking indicator.
    The panel's `overflow: hidden` clips each glow to its own half, so the light reads as
    coming from inside the control rather than haloing the whole thing.
  - **Typewriter glitch (`src/lib/glitch.js`):** on hover the label decodes through special
    characters (`!<>-_\/[]{}=+*^?#$%&@`) and resolves left-to-right, plus stray glyphs flicker
    around the panel. Raw rAF, like `Loader.jsx`. Two things to preserve:
    glyphs re-roll on a **~45ms cadence, not per frame** (at 60fps they blur into noise and read
    as a flicker, not as type); and `scramble()` returns a **cancel** function that snaps to the
    final text — call it on mouseleave/unmount or a fast in-out leaves a button reading `#$%@`.
    The button keeps a real `aria-label` and the mutating span is `aria-hidden`, so the churn
    isn't re-announced every roll. The stray-glyph layer is a **sibling of the panel**, never a
    child — the panel clips its overflow and would eat it.
  - **Guard the mount focus, not just `:focus-visible`.** The gate focuses its first button for
    a11y, and **Chrome matches `:focus-visible` on that programmatic focus** — so testing for it
    alone still fires the hover path and the gate opens with Work lit, mid-scramble, stuck there.
    `readyRef` (set on the rAF after mount) is what actually gates it.
  - **Neumorphism was tried and rejected (2026-08).** Raised plates with paired light/dark
    shadows were built first, then abandoned — worth recording so it isn't re-attempted. Soft UI
    assumes the control and its surround are the same material; here the ground is *moving
    video*, so the relief had nothing consistent to read against and the values had to be pushed
    to cartoon levels (`0.10` light lift, `0.16` inset highlight vs the textbook `0.04`) just to
    register — and still flattened out on bright frames. Adding a shared backing panel fixed the
    ground problem but made the whole thing heavy and un-site-like. **The flat panel is the
    answer**; it says the same thing in the site's own hairline language.
- **FUI tile is a shared token:** the grid SVG data-URI lives in `global.css:root` as
  **`--fui-tile`** (white) and **`--fui-tile-accent`** (gold). `FuiGrid.css` and `Landing.css`
  both consume it — don't paste the string a fourth time.
- **Two-page IA (July 2026 split):** Home = Hero (loop) + Selected Work masonry + footer only.
  **About is its own page at `?page=about`**: About (01) → Clients → Archive (02) → Contact
  (`id="contact"` kept, `AboutContact` named export in `About.jsx`). Routing extended in
  `useRoute.js` (returns `{slug, page}`; intercepts `?page=` links). Nav = Projects (`./#work`) +
  About (`?page=about`); masonry "All work" → `?page=about#archive`. Shared `Footer.jsx` +
  `useMode.js` (Work/Lab persisted). **Route fade** = `.page-fade` keyed wrapper in `App.jsx`
  (opacity-only — transform would break the fixed nav). **Loader plays once per session**
  (`sessionStorage acIntroPlayed`). Lab-mode home is just the hero (masonry is work-only).
  About-page "Projects" stat counts published (non-draft) work only.
- **Gallery video loops (better than GIF):** `images.js` now globs `mp4|webm` too and exports
  `isVideoSrc(url)`; `projectData` flags each gallery entry `video`, ProjectPage renders a muted
  /loop/playsinline `<video>`, and the Lightbox does the same (and skips `new Image()` preload
  for them). **`getHero` skips videos** so masonry cards/thumbnails always resolve to a still,
  and **`hero.<mp4|webm>` is excluded from the glob** (it's reserved for the page hero via
  `heroVideo.js` — otherwise it renders twice).
  **Why:** GIF caps at 256 colours, so smooth gradients band badly. Mars measured:
  GIF 6.0 MB @640px (visible banding even at 256 colours + `sierra2_4a`) vs **h264 1.8 MB
  @1280px, clean** — 3× smaller at 2× the resolution. If a GIF *is* required, never use
  `dither=bayer` on gradients (that ordered pattern was the banding the user spotted) — use
  `palettegen=max_colors=256:stats_mode=full` + `paletteuse=dither=sierra2_4a`.
  **There are now zero GIFs in `src/media` — every loop on the site is h264.** Asur (7 loops:
  hero.mp4 burning ghat + 6 gallery, 8.3 MB GIF → 6.0 MB video at 1280–1600px) and ISBL
  (4 loops, 4.0 MB @460px → 2.0 MB @1280px) were both converted. Encode recipe:
  `-an -vf "scale='min(W,iw)':-2,fps=25" -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p
  -movflags +faststart` (`min(W,iw)` never upscales). Asur's `Opening.2.1` title card needs
  crf 26 — glowing text + particles on black is expensive (3.6 MB at crf 23).
- **Text breaks (`.pd__note`):** large display-type notes between gallery frames, for insights
  about the work. Data = optional `"notes": [{ after, label?, text }]` on a work entry; `after`
  is *how many gallery frames precede it* (0 = above the first frame, any value >= the frame
  count falls to the end of the grid). Rendered inside the gallery grid with
  `grid-column: 1 / -1`, so a break spans the full-bleed row while the type is pulled back to a
  `30ch` centred column (`clamp(22px, 2.9vw, 42px)`, Inter 300, `text-wrap: balance`); optional
  accent `label` sits above as an eyebrow. Editable in the Studio project editor ("Text breaks");
  server clamps `after` and drops empty rows (`notes` key removed entirely when none remain).
  First use: asur (Approach / Process).
- **Letterbox header backdrop (`.pd__backdrop`):** a full-bleed band
  (`clamp(380px,56vh,660px)`) of the project's own frame behind the eyebrow/title/meta.
  **True tilt-shift** = two stacked copies — `.pd__backdrop-blur` (blur 26px, brightness .42)
  under `.pd__backdrop-sharp`, the sharp one revealed through a horizontal
  `mask-image` gradient band so focus falls off above and below — plus a two-axis
  `.pd__backdrop-veil` for legibility that dissolves the band into `--bg`. Header elements get
  `position:relative; z-index:1` to sit above it (`.pd` is the positioning context).
  **Frame choice matters:** with a video hero it uses `heroImg` (the still hero isn't rendered
  anywhere else on those pages, so this also stops that frame going unused); otherwise it takes
  a **mid-gallery still** — using the hero itself stacked a blurred copy directly above the
  identical sharp hero, which read as a duplication bug. Skipped entirely when a project has no
  imagery (shader-hero pages).
- **Project-page media is full-bleed everywhere** (`ProjectPage.css`): `.pd__hero`,
  `.pd__gallery`, `.pd__slots` and `.pd__compares .cmp` all break out of the padded `.pd`
  column with `width:100vw; margin-left:calc(50% - 50vw)`; gallery/slot gaps are **0** and
  radii **0**, so frames butt flush — the same edge-to-edge, zero-gutter language as the home
  masonry. Type (title, meta, brief, credits, eyebrows) stays inset in the column. Hero keeps
  `max-height:88vh`. Applies to every hero type (still / self-hosted loop / Vimeo / shader).
- **Asur page rebuilt (2026-07)** from `Titles CG/Asur WEBSITE/`: **hero is an animated GIF**
  (`001.gif`, the burning-ghat comp from `Ghat_comp_v2_1.mov` — 600px/9fps/2.4s, 2.3 MB; it also
  becomes the homepage masonry card, so it's deliberately smaller than a full-size loop).
  16 gallery items alternating **GIF loop → still** (7 GIFs: ghat, mask, DNA, opening, clay
  bridge-top, bridge angle, bridge collapse; ~8 MB total).
  **1 A/B slider**: `Ghat_WIP_02` (daylight, pre-fire) → `Ghat_fire` (night, burning).
  *Only* verified-aligned pair in the folder — `Ghat_WIP_01`(clay)↔`Ghat_v2`, the Mask v1↔v2 and
  the Grid↔GridIron pairs all failed a `blend=all_mode=difference` check (doubled geometry =
  different camera/rotation), so they'd ghost on the wipe and were left as plain stills.
  All the Bridge_* clips are grey-clay previz with no textured counterpart.
- **Per-project compare labels** (`LABELS` in `lib/compares.js` → `getCompareLabels(slug)`):
  default is `Plate → Final` (shot VFX breakdown, e.g. monsoon); **asur overrides to
  `WIP → Final`** since it compares two CG renders, not a filmed plate.
- **ISBL page enriched (2026-07):** gallery renumbered `001…019` in two movements —
  **colour section `001–013`** (stills with the 4 GIF loops woven in), then a **grayscale block
  `014–019`** (hero `001.jpg` is the original cover; `image`/`gallery` fields cleared so the
  folder glob drives everything). Sources: the
  22 per-shot ProRes masters in Website Master `Events /ISBL/`.
  **4 GIFs** (burnout, wheelies, traffic lights, DNA) built two-pass with
  `palettegen(max_colors=64–80,stats_mode=diff)` + `paletteuse(dither=bayer:bayer_scale=4)`
  at **460px / 10fps / ~2.2s → ~0.7–1.3 MB each, 4 MB total** (a first pass at 620px/12fps/128
  colours came out 12.8 MB — too heavy; the repo convention warns about GIF bloat).
  **6 grayscales** via `format=gray,eq=contrast=1.12` at 2000px. Note `Exhaust_v1.mov` is
  near-black across its whole duration (frames came out 1.6–8 KB) — unusable as a still;
  `Visor`/`FootCLose`/`opening_dolly` have the best tonal range.
- **Lab-mode hero cover** = Ansh's own ornamental pencil drawing
  (`src/media/lab/lab-cover.jpg`, imported in `Hero.jsx` as `LAB_IMG`) — **replaced the stock
  Unsplash studio photo**; no stock imagery remains anywhere in `src/`. Styled
  `.hero__media--art`: `object-fit: contain` (the scan is already matted on black, so the torn
  deckle edges float seamlessly on the page bg) + `brightness(.78)` — dimmed far less than the
  photo treatment so the pencil linework survives under the veil. Source:
  `Downloads/Texturelabs_Paper_368L.jpg` (4240×3239 → 2400px, 1.1 MB).
- **Lab media lives in `public/projects/<slug>/`, NOT `src/media/lab/`.** `images.js` globs
  `../media/projects/*/*` only, and `projectData.js` flattens work + lab into one slug namespace,
  so a lab item's folder must sit alongside the work projects. (`src/media/lab/` holds just
  `lab-cover.jpg`, which `Hero.jsx` imports directly.) Lab entries hard-code `image:''` and
  `gallery:[]` in `projectData.js`, so the folder glob is the *only* thing driving their media —
  filename order is the gallery order and the first non-video file is the hero.
- **Lab: BTS Screen Captures (2026-08-07)** — `bts-captures` populated from Website Master
  `_BTS/` (8 OBS-style screen recordings, 2560×1440/30fps, **12.9 GB, 5h46m total**).
  **16 items, 6.6 MB**: 13 stills + 3 loops, interleaved (`005/007/010.mp4`). Mostly Cinema 4D +
  Octane on the **Mindscapes** build (every render-farm job is `MSD_*`) — a bust growing green
  X-Particles spline hair — plus clip 2's white folded-plane world, and `016.jpg` catching
  `NMS_wip_03[1].mp4` on screen. Hero `001.jpg` = the green thread head rendering live in Octane.
  - **⚠️ Clips 5 and 6 were deliberately EXCLUDED — they contain client-confidential material.**
    `2025-08-23 15-07-06.mp4` is a full **Google AI "Anniversary Flow" pitch deck** with readable
    slide content; `2025-08-24 20-48-15.mp4` mixes browser windows and a Google "AI Mode" screen
    with the *Nothing Makes Sense* edit. **The repo is public — do not import these without the
    user clearing them.** The other 6 clips were checked frame-by-frame at full res: no email,
    no credentials, no third-party confidential content.
  - Stills: `-ss <t> -i <clip> -frames:v 1 -q:v 2` at native 2560px, then the repo pipeline
    (`sips -s format jpeg -s formatOptions 82 -Z 2000`).
  - Loops: **6s at exactly 1280×720** — an exact half of the 2560×1440 source, so UI text
    downscales cleanly. `-vf "scale=1280:720,setsar=1,fps=25" -crf 23 -preset slow` → ~0.35–0.45
    MB each. Note `scale='min(1400,iw)':-2` produced 1400×788 with **SAR 1576:1575**, which makes
    the browser report `videoWidth` 1401 — harmless, but prefer exact 16:9 targets here.
  - **Finding usable moments needs a motion scan, not guesswork** — these are hours of a mostly
    static screen, and hand-picked windows came back near-dead (mean tblend diff ~0.001–0.01).
    Scan short windows instead: `-ss <t> -t 2 -vf "scale=240:-2,fps=12,tblend=all_mode=difference,
    signalstats,metadata=print:key=lavfi.signalstats.YAVG"` averaged per window, sampled every
    150s, then sort descending. Real peaks scored 0.5–2.2 and were all genuine (viewport orbits,
    a render refining, scrolling a material library).
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
  project pages. Drop frame-matched passes into `public/projects/<slug>/compare/` named
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
- **Studio runs without Claude.** `Studio.command` at the repo root is a double-click launcher:
  puts `~/.local/bin` on PATH, `npm install` on first run, picks a free port (5173+, honoured by
  `vite.config.js` via `process.env.PORT`), starts the dev server, opens `/admin`, and kills the
  server when the window closes. The Studio's **Publish bar** runs `tools/ship.sh` via
  `POST /admin/api/publish` — so the whole edit → publish loop needs no terminal.
  **Publish state is on disk** (`/tmp/chandparaaa-publish.{json,log}`), and the child is
  `detached` writing straight to that log: `ship.sh` switches git branches, which makes Vite
  reload this plugin mid-run and previously wiped the in-memory job (the publish still
  completed — only the UI status was lost). `GET /api/publish` also falls back to the log's own
  end markers ("Live at" / "failed") to resolve a job whose child handle was lost.
- **Studio hub (dev-only):** `http://localhost:5173/admin` — Vite plugin (`apply:'serve'`) in
  `tools/vite-admin-plugin.js` + `tools/admin.html`; never ships to `dist`; needs `npm run dev`.
  **Three tabs:**
  - **Projects** — grid of every project (cover thumb + live/draft dot). Click one to open the
    full editor: title, subtitle, category, client, year, platform, role, Vimeo id, description,
    credits (with autocomplete + auto-registration of new names), draft/featured toggles, and an
    **image manager** (drag-drop or click upload → auto `sips` optimize to ≤2000px q82 JPEG and
    sequential `NNN.jpg` naming; set any image as cover; delete — clears `image` if it pointed
    there). Plus the create-drafts rows.
  - **Order** — drag-to-reorder (or ↑↓) list of every work project = the site's default
    running order. Works because the masonry's `index` sort has **no comparator**, so it renders
    `data.work` in array order; `PUT /admin/api/order` rewrites that array and **renumbers `num`
    to 01…N** so the printed index stays contiguous. Unlisted slugs keep their relative position
    (defensive). Drafts hold a slot but stay hidden on the live site. Has a dirty flag + Revert;
    `reconcileOrder()` keeps the list in step with adds/deletes **without** discarding a pending
    arrangement.
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
    upscales) into `public/about/portrait.jpg`. `src/lib/aboutImage.js` globs that dir;
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

