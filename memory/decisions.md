# Decisions — locked, with the why

One line per decision, newest first. Full implementation detail lives at the pointer; this
file exists so a decision is never re-litigated.

**Before re-opening anything here, read the why.** If the why no longer holds, that is a new
decision — add it, mark the old one superseded, and never silently delete.

---

**2026-08-09 · Project media lives in `public/projects/`, and the build enumerates it from a
committed manifest — never a disk scan.** Four `import.meta.glob` calls were replaced by
`src/data/media-manifest.json` + `src/lib/mediaManifest.js`. The build must work on a machine
with none of the media, because that is what a CI runner is once media moves to object
storage; a glob returns `{}` there and produces a green build with empty galleries. Every
export signature was kept identical, so no component changed. Proven by building a media-less
copy and diffing: markup and bundles byte-identical.
→ owner: `docs/media-pipeline.md`, "Phase B"

**2026-08-09 · The manifest guard runs as npm `prebuild`, not in application code.** A
runtime throw cannot fail a build. Consequence: **never** substitute `npx vite build` for
`npm run build`, in CI or locally.
→ owner: `memory/lessons.md`, grep "wrong layer"

**2026-08-09 · Accepted tradeoff: project media lost content-hashed filenames.** It now
serves from stable paths (`/projects/<slug>/002.jpg`). Replacing bytes under a stable name
with a long cache serves stale content for the whole window. Survivable on GitHub Pages'
short cache; **Phase C must add cache tiers and `-v2` renaming** rather than overwriting.
→ owner: `docs/media-pipeline.md`, "The tradeoff taken"

**2026-08-08 · `reel-edit-2026` is a draft, not a deletion.** It had no media at all, so it
was a bare title sitting in the Lab archive. Marked `draft: true` at Ansh's request rather
than removed — the entry is intact and `?p=reel-edit-2026` still previews. Drop media into
`src/media/projects/reel-edit-2026/` and clear the flag to republish.
→ commit `6940c1c`

**2026-08 · Card reveal is a plain rAF-throttled scroll position check — deliberately NOT
ScrollTrigger and NOT IntersectionObserver.** Both only react to a *crossing*. A card that
jumps from below the fold to above it in one move — fast scroll, anchor jump, re-sort,
appended batch, column change — never crosses, and stayed permanently invisible. That was the
"cards aren't loading" bug. The check simply reveals anything already above the threshold,
however it got there.
→ owner: `docs/design-state.md`, grep "Card reveal"

**2026-08 · The hero wordmark decodes in place; it does not scatter.** The old per-letter
positional scatter was removed. **Nothing in the reveal may touch x/y/rotation — opacity
only**, or it is a scatter again.
→ owner: `docs/design-state.md`, grep "Hero wordmark"

**2026-08 · Lab media lives in `src/media/projects/<slug>/`, not `src/media/lab/`.** One glob,
one location; `images.js` does not need to know what is Lab and what is Work.
→ owner: `docs/design-state.md`, grep "Lab media"

**2026-08 · Nav brand string is "Ansh Chandpara".** Changed by an assistant, reverted by Ansh.
Settled.
→ owner: `docs/design-state.md`, grep "Brand strings"

**2026-07 · Long-form video goes to Vimeo; only the background loop is self-hosted.** Each
`projects.json` entry carries a numeric Vimeo ID. The agent cannot upload — Ansh supplies IDs.
The single self-hosted exception is `public/hero-loop.mp4`, because it must autoplay muted
behind the landing gate with no third-party player.
→ owner: `CLAUDE.md`, section "Conventions / decisions"

**2026-07 · Two-page IA.** Home = hero loop + Selected Work masonry + footer only. Everything
else moved off the front door.
→ owner: `docs/design-state.md`, grep "Two-page IA"

**2026-07 · Masonry ratios are a 7-step modular set applied by display position, not by
project.** Seven steps is coprime with 2, 3 and 4 columns, so no two columns share a ratio
sequence at any density, and the rhythm survives any re-sort.
→ owner: `docs/design-state.md`, grep "modular"

**2026-07 · Undated projects always sort last**, in both year directions — never "oldest".
Verified 2026-08-09, the undated set in `work` is `union-day-yas-mall`, `savi-bb`,
`dico-battery`, `sketches-live`. *(`docs/design-state.md` still names `raat-khatam` here — that
is stale; it has `year: 2025`. Corrected in this file, which owns the fact.)*
→ owner: `docs/design-state.md`, grep "Undated"

**2026-07 · `dev` is the working branch; `main` is only reached through `ship.sh`.** The script
refuses to run off `dev` and aborts if the build fails, so a broken build cannot reach the live
site.
→ owner: `~/.claude/RULES.md` rule R1

---

## Pending, not yet decided

- **Object storage for media.** Cloudflare R2 recommended (zero egress). Not yet chosen; blocks
  the media-pipeline migration. → `~/.claude/plans/joyful-sparking-pebble.md`, Stage 4 Phase C
- **Which hero-loop master to use.** Newer masters exist at `Edit/Website Home Loop 02.mp4` and
  `03.mp4`; also open is whether to shrink the loop from 8.7 MB to ~4–5 MB. Must be re-encoded
  from the iCloud master, never from the optimised copy.
