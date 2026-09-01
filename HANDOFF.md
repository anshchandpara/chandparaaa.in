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
**2026-09-01. Media is on Cloudflare R2 and the repo no longer carries it. Live at `2f4c0e3`.
Deploy artifact 121 MB -> 12 MB. Working tree clean, `dev` level with `main`.**

SITE STATE: 27 `work` entries (22 published, 5 draft), 5 `lab` (1 published, 4 draft). Ansh is
adding Vimeo IDs himself — do not chase those.

MEDIA NOW LIVES IN R2. Bucket `chandparaaa-media`, served from
`https://pub-67342d07ad21409f99f55162c3acdbef.r2.dev`, wired via `VITE_MEDIA_BASE_URL` in a
committed `.env.production`. `public/projects/` is gitignored; the files remain on disk so
`npm run dev` works offline and the manifest can be regenerated. Verified live: bundle points
at R2, media 404s on the site origin (correctly gone from the deploy) and 200s from R2.

**RUN `npm run media:verify` BEFORE EVERY SHIP.** There is no local fallback any more — a
missing object is a broken image on the live site, not a slow one. It is manifest-driven, not
a dist scan; sabotage-tested (missing -> 1, empty manifest -> 2, no creds -> 2, healthy -> 0).
After any encode: `npm run media:sync && npm run media:verify`.

THREE THINGS NOT TO BREAK:
1. **`npm run build`, never `npx vite build`** — the manifest guard is npm's `prebuild`.
2. **Both project hooks live in `Work/Claude/.claude/settings.json`**, the PARENT folder. A
   settings file inside this repo never loads, and fails silently.
3. **The media manifest REBUILDS from a disk scan.** Never regenerate it where media is absent.
   CI has `SKIP_REBUILD_MANIFESTS=1` and a `git diff --exit-code` belt.

KNOWN LIMIT: `r2.dev` is Cloudflare's development-grade endpoint and is rate-limited. No
throttling seen at 20 rapid requests, but a traffic spike is untested and there is now no
fallback. The fix is a custom domain, which needs the DNS zone moved to Cloudflare —
nameservers are at GoDaddy and the apex serves the live site from GitHub Pages, so that is a
deliberate job with real blast radius, not a side effect.

NOT DONE: `media:verify` is not wired into `ship.sh`. It is the obvious next guard now that
there is no fallback, but adding it was not bundled into this deploy.

WAITING ON ANSH: (1) eyeball the glitch wordmark on the live site — I could never verify it
animates, only that it is opacity-only and deployed; (2) the Voice section of
`~/.claude/RULES.md` and the "unknown" block in `memory/preferences.md`; (3) confirm
`/Volumes/T7/` is a real backup of `Website Master/`.
<!-- CURRENT:END -->

## Ship log (append-only, newest first)

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
