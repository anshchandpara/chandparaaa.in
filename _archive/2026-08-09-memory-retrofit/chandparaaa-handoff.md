# Handoff — chandparaaa.in portfolio

## Context

This session built out Ansh Chandpara's portfolio site (React + Vite, live at
**https://chandparaaa.in**). The context window is filling, so this document exists to let a
fresh session pick up without re-deriving anything.

**The durable reference is `ansh-portfolio/CLAUDE.md`** — it was maintained meticulously all
session and covers architecture, every design decision, encode recipes, and known gotchas.
**Read it first.** `ansh-portfolio/README.md` covers structure, the media pipeline, and the
Studio app. This handoff deliberately does *not* duplicate them.

---

## Current state (verified at handoff)

- Repo: `/Users/anshchandpara/Documents/Work/Claude/ansh-portfolio`
- Branch **`dev`**, clean and in sync with `origin/main` at `17989a2`
- **22 published projects**, 5 drafts: `hashishbhai-dhanji-rasla`, `kyra-itc-farmlite`,
  `storm-plus`, `tasc`, `sketches-live`
- 5 Lab items exist; 4 have no media
- Media weight: `src/media` 95 MB, `public` 9.1 MB (hero loop is 8.7 MB of that)
- Everything shipped and deployed successfully; last build clean

## How work ships (no terminal required)

- Double-click **`ansh-portfolio/Studio.command`** → starts the dev server, opens `/admin`
- The Studio has tabs: **Projects / Order / Team / Design**, plus a **Publish bar** that runs
  `tools/ship.sh` end-to-end and reports "✓ Live at chandparaaa.in"
- CLI equivalents: `npm run dev`, `npm run status`, `npm run ship "message"`
- **Never commit to `main`** — `dev` is the working branch; `ship.sh` handles the merge and
  aborts if the build fails

## Open threads

1. **Text-break copy is AI-drafted.** 27 notes were added across 17 projects, written from each
   project's existing description and imagery. They are *first drafts in Claude's words* and
   were flagged as such to the user — he should rewrite them in his own voice via
   Studio → Projects → Text breaks.
2. **5 published projects have no text breaks**, deliberately: `raat-khatam`,
   `union-day-yas-mall`, `savi-bb`, `dico-battery`, `varun-grover-comedy-special`. Their
   descriptions are one-liners, so writing "insight" would have been fabrication. These need
   the user's own words.
3. **4 drafts have partial metadata** (missing client/role/credits) — Kyra × ITC, Storm Plus,
   TASC, hASHISHBHAI. `sketches-live` is completely empty (no media/year/desc) and would render
   as a blank card if published.
4. **Mars Vimeo IDs** — the three MARS films currently play as self-hosted loops; the user may
   still want Vimeo embeds.
5. Several projects have **no `year`** (raat-khatam, union-day-yas-mall, savi-bb, dico-battery)
   — they sort last in both year directions by design.

## Gotchas that will waste your time (all documented in CLAUDE.md)

- **The preview pane is frequently `document.visibilityState === "hidden"`.** That pauses rAF
  (GSAP tweens freeze mid-state) *and* defers IntersectionObserver callbacks — the homepage grid
  will appear stuck at 8–16 cards and elements will read `opacity: 0`. This is a measurement
  artifact, **not** a site bug. Verify via the Archive page (no pagination) or a fresh
  `npm run build` before concluding anything is broken.
- Screenshots reset scroll to top; hide sections via JS to capture below-fold content.
- The console log buffer goes stale across reloads — trust a fresh build.
- The SPA route drifts between tool calls; re-assert `location.search` before asserting state.
- ffmpeg is a static binary at `/tmp/node_modules/ffmpeg-static/ffmpeg` and **`/tmp` clears on
  reboot** — reinstall with `cd /tmp && npm install ffmpeg-static`. No `ffprobe`.
- **Video encodes must force keyframes at scene cuts** — modern ffmpeg passes `sc_threshold=0`
  to libx264, which silently disables scene-cut detection and causes visible smearing across
  hard cuts. This caused a real reported bug. Recipe and verification step are in CLAUDE.md.

## Working style that fit this user

He is a director/designer, not an engineer — he judges by eye and catches real visual defects
(he spotted GIF banding and a video glitch that still-frame comparisons missed). Show him
screenshots, verify claims before making them, and flag anything that's a guess. He iterates
fast and ships often. Don't fabricate facts about his projects, credits, or process.

## Suggested skills for the next session

- **`anthropic-skills:frontend-design`** — for further visual/UI work on the site; it matches
  the design-quality bar this project holds.
- **`anthropic-skills:animate`** — if touching motion (the site has a deliberate linear-easing
  motion language; see CLAUDE.md before changing it).
- **`verify`** — before claiming any change works; this session's main failure mode was the
  preview pane lying about state.
- **`code-review`** — if the next session makes structural changes to `Work.jsx`,
  `ProjectPage.jsx`, or `tools/vite-admin-plugin.js`, which have accumulated real complexity.
- No skill is needed for content work (adding projects/media) — the Studio and the documented
  media pipeline cover it.

## Sensitive info

None in the repo. `gh` is authenticated as `anshchandpara` via the macOS keyring (no tokens on
disk). The repo is public; don't add anything private to it.
