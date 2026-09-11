# Session handoff — Ansh Chandpara Portfolio

## How this file works

Three parts, three lifecycles:

- **CURRENT** — rewritten wholesale at every checkpoint, capped ~50 lines, always true right
  now. The only part to read in full.
- **Ship log** — append-only, newest first. History.
- **Decisions index** — one line per decision, pointing at the file that owns the full text.

Do not rename or remove the CURRENT markers: `tools/hooks/inject-current.sh` finds the block by
searching for those exact comments, and a renamed marker makes it print nothing, which looks
identical to "there was nothing to print".

<!-- CURRENT:START -->
**2026-09-11. Live at `da432ee`. The Reveries room is open — the lab's front door now leads
somewhere.**

R2 CORS is set (`Access-Control-Allow-Origin: *` on GET; the OPTIONS 403 is irrelevant —
image loads with `crossOrigin` are simple requests, no preflight). Verified live: 32/32
objects fetch under CORS, the room loads 16/16 textures, `L·006 · Reveries` is in the Archive
in lab mode, and the lab hero CTA opens it. One caveat for anyone who visited the draft page
BEFORE the policy existed: their browser may hold 30-day cached responses with no CORS
header and see missing pieces — a hard reload fixes it, and no real visitor ever reached the
draft.

SITE STATE: 27 `work` (22 published), 6 `lab` (2 published: bts-captures, reveries). R2 holds
305 objects, `media:verify` PASS. 2 of 32 entries carry a Vimeo ID.

WAITING ON ANSH: (1) judge the room — arrangement, drift, fog, focus size; every number is in
`TUNE` at the top of `src/components/lab/reveriesScene.js`; the front piece sits close to the
left edge at the entrance (`radius`); (2) rewrite the Reveries title + desc in
`projects.json`, currently my first draft; (3) the lab CTA copy "Browse experiments" now lands
on one piece; (4) an Adobe Fonts web project (Obviously Variable, Neue Haas Grotesk, Ambroise,
Bely) — send the kit ID and the type direction proceeds; (5) the title-fit playground on the
Desktop if a different curve than 2 lines / 56–136px.

SETTLED: Reveries is a scrolling room with click-to-focus; direct-manipulation plates were
tried and declined → `memory/decisions.md`.

THREE THINGS NOT TO BREAK:
1. **`npm run build`, never `npx vite build`** — the manifest guard is npm's `prebuild`.
2. **Both project hooks live in `Work/Claude/.claude/settings.json`**, the PARENT folder.
3. **The media manifest REBUILDS from a disk scan.** Never regenerate it where media is absent.

KNOWN LIMIT: `r2.dev` is rate-limited with no fallback; a custom domain needs the DNS zone
moved to Cloudflare — a deliberate job with real blast radius.
<!-- CURRENT:END -->

## Ship log (append-only, newest first)

**2026-09-11 — Reveries room opened** — commit `da432ee`.
Ansh set the R2 CORS policy; `reveries` flipped from draft to published. Verified live: 32/32
objects fetch under CORS, 16/16 textures in the room, Archive row present, lab CTA resolves to
`?p=reveries`. Found on the way: a browser that loaded the draft before the policy holds
poisoned 30-day cache entries with no CORS header — `fetch(url, {cache:'reload'})` per object
repairs it; recorded so the next "some pieces are missing" report is not chased as a bug.

**2026-09-11 — type + hierarchy pass, title fit, dead CSS, Reveries room (draft)** — commit `b02dea7`.
One commit carrying a session's work: a three-step spacing scale replacing a flat 63–90px
rhythm; text-break notes 42→30px and left-aligned; ~16 credit hairlines → 1; card hover
captions no longer restate the cover; 120 lines of dead CSS removed with a computed-style
diff across 663 elements as proof; `useTitleFit` binary-searching each project title to its
column — fixes MANORATHANGAL rendering as MANORAT, which was live; and the Reveries lab room
(16 ink cut-outs, 141 MB → 7.5 MB as two-tier alpha WebP, three.js, pointer parallax, scroll
travel, click-to-focus with fog recession). Shipped as `draft: true` because the R2 bucket
has no CORS policy and WebGL refuses the textures — a dashboard setting only Ansh can make.
Verified live: fitted title 69px and whole; the room renders with 16/16 textures blocked, as
expected. What now inherits the fix: any lab entry can have its own page via
`src/components/lab/pages.js`, and any cut-out series goes through `npm run media:cutouts`.

**2026-09-01 — Lootere and Equals lead with their films** — commit `2c7c61c`.
First two Vimeo IDs of 32. Also added `npm run media:pull`, the missing counterpart to
`media:sync`, after the previous ship deleted all 273 local media files: `ship.sh` switches
branches, and `main` still tracked them at checkout time. Nothing was lost (R2 held 273/273,
manifest intact, and the manifest builder refused to regenerate from the empty tree). Verified
live: both IDs in the deployed bundle, 7/7 gallery images loading from R2, 0 broken.

**2026-09-01 — media moved to Cloudflare R2** — commit `2f4c0e3`.
273 objects uploaded (45s, 0 failed), `public/projects/` untracked and gitignored, site
pointed at r2.dev via `.env.production`. Deploy artifact 121 MB -> 12 MB with byte-identical
markup. Verified live: media 404s on the site origin and 200s from R2, which is the proof the
smaller artifact actually deployed. Also replaced the pack's dist-scanning verifier, which
would have reported a pass having checked nothing — `dist` contains zero literal media URLs
because they are assembled at runtime. What now inherits the fix: the repo stops growing, and
adding media is sync + verify rather than a commit.

**2026-09-01 — glitch wordmark + manifest layer + memory retrofit** — commit `4395000`.
Three commits shipped together, because `ship.sh` merges `dev`->`main` wholesale and all of
it was uncommitted side by side. The wordmark now decodes in place instead of scattering
into position; media moved to `public/projects/` and the build stopped scanning the disk for
it. Verified live: 273/273 media URLs resolve at the new paths (two transient 503s from
Pages throttling under rapid sequential requests, both 200 on retry). What now inherits the
fix: media can leave the repo without the build noticing, which is what Phase C needs.

**2026-08-09 — media pipeline, phases A + B** — not committed.
Phase A: `npm run media -- <slug>` encodes from `~/media-masters/<slug>/` into
`public/projects/<slug>/`, preset chosen by filename suffix. The upstream pack forces **no**
keyframes anywhere, which would have reintroduced the hero-loop smear, so a scene-cut guard
was added: detect cuts → force a keyframe at each → read the I-frames back and exit non-zero
if any cut is uncovered. Sabotage-tested; with forcing neutered it names 2.08s, the exact cut
from the original glitch report.
Phase B: media moved `src/media/projects/` → `public/projects/`, and **four**
`import.meta.glob` calls (images, heroVideo, compares, aboutImage — the plan had named two)
became one committed manifest. Every export signature unchanged, so no component was touched.
`tools/vite-admin-plugin.js` was repointed too, or every Studio upload would have vanished
silently. Proven: a media-less copy of the repo builds with byte-identical markup and
bundles. What now inherits the fix: media can leave the repo in Phase C without the build
noticing.

**2026-08-09 — studio-systems migration, stages 0–3** — not committed.
Pack extracted to `~/Documents/Work/Claude/studio-systems-pack/`, `check-pack.mjs` clean.
`ffmpeg` moved out of `/tmp` and `ffprobe` installed for the first time (both `~/.local/bin`);
OIIO/OCIO/OpenEXR/numpy pinned at `~/.venvs/oiio` with `oiiotool` on PATH; `sharp` added.
Memory layers L0–L5 built: `CLAUDE.md` 610 → 117 lines, architecture moved verbatim to
`docs/design-state.md`, `chandparaaa-handoff.md` archived with a MANIFEST under
`_archive/2026-08-09-memory-retrofit/`. Eight skills in `~/.claude/skills/` — six de-branded
from the pack plus `hero-encode` and `portfolio-publish`. Also corrected a stale fact: the
undated set is `union-day-yas-mall`, `savi-bb`, `dico-battery`, `sketches-live`, not
`raat-khatam` (which has `year: 2025`). What now inherits the fix: every craft skill and the
whole media pipeline had been blocked on `ffprobe` not existing.

**2026-08-08 — hide Reel Edit 2026 from the live site** — commit `6940c1c`.
It had no media at all, so it was a bare title in the Lab archive. Marked `draft: true` rather
than deleted; `?p=reel-edit-2026` still previews.

**2026-08-08 — landing gate: split halves, finer FUI grid, typewriter glitch on hover** —
commit `060da25`.

**2026-08 — text breaks across 17 projects** — commit `17989a2`.
27 display-type notes between gallery frames. **The copy is AI-drafted and still needs
rewriting in Ansh's voice** via Studio → Projects → Text breaks.

**2026-08 — hero loop glitch fixed: forced keyframes at scene cuts** — commit `c028504`.
The encoder was predicting across hard cuts. Cause and recipe: `docs/media-recipes.md`.

## Decisions index (full text lives at the pointer)

- Long-form video goes to Vimeo; only the background loop is self-hosted. → `memory/decisions.md`, grep "Vimeo"
- Card reveal is a plain rAF scroll check, not ScrollTrigger or IntersectionObserver. → `memory/decisions.md`, grep "Card reveal"
- The hero wordmark decodes in place; nothing in the reveal may touch x/y/rotation. → `memory/decisions.md`, grep "decodes in place"
- Masonry ratios are a 7-step modular set applied by display position. → `memory/decisions.md`, grep "modular"
- `dev` is the working branch; `main` is only reached through `ship.sh`. → `~/.claude/RULES.md` rule R1
- Object storage not yet chosen; R2 recommended. → `memory/decisions.md`, "Pending, not yet decided"
