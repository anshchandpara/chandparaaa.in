# CLAUDE.md — Ansh Chandpara Portfolio

Cinematic dark portfolio for **Ansh Chandpara — Creative Director · Title Designer · Filmmaker**.
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
- **ffmpeg / ffprobe** — both on `PATH` at `~/.local/bin`, alongside `node`/`npm`/`gh`/`uv`.
  Durable across reboots (2026-08-09). `ffmpeg` 6.0 is an arm64 static build
  (libx264/x265/vpx/aom/svtav1); `ffprobe` n4.4.1 symlinks to
  `~/.local/opt/ffprobe/node_modules/@ffprobe-installer/darwin-arm64/ffprobe`.
  **Versions differ (6.0 vs 4.4.1)** — fine for probing, but don't assume 6.x-only
  `ffprobe` flags exist. Use `ffprobe -v quiet -print_format json -show_streams` for
  video info; `mdls` is no longer needed.
  *Previously a `/tmp/node_modules/ffmpeg-static/ffmpeg` binary that vanished on every
  reboot, with no `ffprobe` at all.*
- **`sips`** (macOS) for image resize/convert.
- **Shell is zsh; system bash is 3.2:**
  - zsh doesn't word-split `for x in $var` — use literal lists or `while read`.
  - no bash assoc arrays (`declare -A`); use `$((10#$n))` for zero-padded ints.

## Conventions / decisions
- **Project videos → Vimeo.** Each `projects.json` entry has a `"video"` field (numeric Vimeo ID)
  → embed hero above the stills. Agent can't upload; user provides IDs.
  Exception: the **hero background loop is self-hosted** (`public/hero-loop.mp4`, 2560×1440).
  **Before re-encoding it, read `docs/media-recipes.md`** — keyframes must be forced at the
  scene cuts or the encoder smears across every hard cut.
- **Self-hosted project hero loop:** drop a `hero.mp4` (muted, web-optimized) into
  `public/projects/<slug>/` and the project page leads with it as an autoplaying loop
  (`lib/heroVideo.js` → `getHeroVideo`; `.pd__hero-loop` in ProjectPage; Vimeo `video` still
  wins). Rendered full-bleed. First use: monsoon-season-mixtape (a 2× timelapse, 30s → 1.8 MB
  at 1080p; a GIF of the same would be 40–60 MB — timelapses compress extremely well).
- **YouTube "Watch the film" link:** optional `"youtube"` field (full URL) on a work entry →
  `.pd__watch` CTA on the project page (opens in a new tab). Editable in the /admin project
  editor (`f-youtube`, in the EDITABLE allowlist). Hidden when empty.
- **Media pipeline:** stills are ~2000px JPEGs named `001.jpg, 002.jpg …` in
  `public/projects/<slug>/`. **Nothing scans that directory at build time** — enumeration
  comes from the committed `src/data/media-manifest.json` via `src/lib/mediaManifest.js`, so
  the build works on a machine with no media. First sorted file (or the entry's designated
  `image` basename) = hero, rest = gallery. **Adding media by hand means running
  `npm run media:manifest`**; the pipeline and the Studio do it for you. `npm run build`
  refuses to run against a missing or empty manifest. See `docs/media-pipeline.md`.
- **Edit `projects.json` via small Python scripts** with
  `json.dump(d, f, indent=2, ensure_ascii=False)` + trailing newline (preserves em-dashes/format).
- **Project facts** are mirrored from the user's `Website Master/cms.html` (`SEED_ENTRIES`).
- **Credits/collaborators:** `src/lib/people.js` maps name → URL (blank = plain text); the owner
  (Ansh) is always accent-highlighted. Credit strings are `"Role — Name1, Name2"` in `projects.json`.
- **Design language:** dark (`--bg #0a0a0a`), warm gold accent (`--accent #d98b2b`),
  Space Grotesk (display) + Inter (body). Source masters live OUTSIDE the repo at
  `…/iCloud Drive (Archive)/Documents/Documents Anshs MacBook Pro/Website Master/`
  (`Titles CG/`, `MVs/`, `PVs/`, `Events /`, `Edit/`).

## Session memory protocol

**At session start:** read this file, then `memory/preferences.md`, then the CURRENT block of
`HANDOFF.md` — and only that block. Everything else is grep-on-demand.

**At checkpoints** (something shipped and was verified, a decision locked, a thread parked,
before a compaction, session end): **rewrite** the CURRENT block, never append to it. If
something shipped, prepend to the ship log. Durable facts go to their owner file immediately.

**One fact, one owner.** The table lives in `memory/PROTOCOL.md`. Cross-project facts go to
`~/.claude/projects/-Users-anshchandpara-Documents-Work-Claude/memory/`; project facts stay here.

Prompts are logged automatically by a hook into `memory/user-prompts.md` — never write to it
by hand.

## Read on demand

This file is loaded every session, so it stays a spine. The depth lives here:

| File | Read it when |
|---|---|
| `HANDOFF.md` | **always, the CURRENT block** — what is true right now, and who holds the next move |
| `README.md` | structure, design tokens, the imagery / video / credits / location systems |
| `docs/design-state.md` | changing the hero, masonry, landing gate, page systems, or the Studio/Render dev tools |
| `docs/media-pipeline.md` | processing a master into delivery files — `npm run media -- <slug>` |
| `docs/media-recipes.md` | encoding by hand, pulling stills from a master, or verifying in a headless browser |
| `memory/decisions.md` | before re-opening a settled decision |
| `memory/lessons.md` | before debugging something that smells familiar |
| `~/.claude/RULES.md` | the standing rules (R1–R7) that outrank anything here |
