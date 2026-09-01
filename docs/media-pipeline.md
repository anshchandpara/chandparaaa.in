# Media pipeline — Phases A and B

Built 2026-08-09 from `studio-systems-pack/04-media-pipeline/`, adapted for this repo.

- **Phase A — the encode half.** Masters in, web-ready delivery files out, one command.
- **Phase B — the manifest.** The build no longer scans the disk for media, so it works on a
  machine that has none. This is the prerequisite for media ever leaving the repo.
- **Phase C — object storage.** Not built. Needs a Cloudflare R2 account.

## The one command

```bash
npm run media -- <slug>
```

or directly:

```bash
node tools/pipeline/process-masters.mjs <slug>          # one project
node tools/pipeline/process-masters.mjs                 # every staged project
node tools/pipeline/process-masters.mjs --dry-run <slug>  # see the plan, write nothing
node tools/pipeline/process-masters.mjs --force <slug>    # re-encode even if up to date
```

## How it works

```
~/media-masters/<slug>/            you copy in the ONE master you want processed,
        │                          named so the filename carries the encode intent
        ▼
   process-masters.mjs
        │
        └── encode-video.mjs       preset chosen by FILENAME SUFFIX
               │                   + a keyframe forced at every scene cut
               │                   + the result verified against the encoded bytes
               ▼
   public/projects/<slug>/     <name>.mp4, <name>-poster.jpg, <name>.900p.mp4
        │
        ▼
   build-media-manifest.mjs    scans, writes src/data/media-manifest.json (COMMITTED)
        │                      — run automatically at the end of every pipeline run
        ▼
   src/lib/mediaManifest.js    the only thing the build reads. Never touches disk.
```

**Masters are staged, not reorganised.** `Website Master/` keeps its discipline-based
layout (`Titles CG/`, `MVs/`, `PVs/`, `Events /`, `Edit/`). You copy the one file you want
into `~/media-masters/<slug>/` and rename it with the intent suffix. Nothing in the
hundreds of GB archive moves.

**Masters are not backed up by this pipeline.** It reads them and never writes to them.
See rule R3.

## The suffix convention

The filename carries the encode intent, so it survives being moved, needs no lookup table,
and lets one script serve a laptop and (later) a CI runner with no extra flags.

| Master filename | Preset | What you get |
|---|---|---|
| `x.loop.mov` | `loop` | 1080p H.264 CRF 22, **audio stripped**, + 900p sibling |
| `x.loop-audio.mov` | `loop-audio` | muted autoplay loop that keeps its AAC track for an unmute toggle |
| `x.mov` *(no suffix)* | `showcase` | 1080p CRF 20 + AAC 192k, for "watch this" blocks |
| `x.hero-2k.mov` | `hero-2k` | 1440p CRF 20, flagship tier |
| `x.alpha-loop.mov` | `alpha-loop` | transparent: HEVC `.mp4` + VP9 `.webm`, no poster |
| `x.jpg` / `.png` / `.gif` | — | copied through as-is |

Matching is **longest-first**, so `.alpha-loop` beats `.loop`. An unrecognised dotted tail
**warns and falls back to showcase** rather than failing a batch.

The suffix is stripped from the output: `homeloop.loop.mp4` → `homeloop.mp4`.

## The scene-cut guard (added here, not in the upstream pack)

The pack's presets place **no keyframes at scene cuts**. Modern ffmpeg passes
`sc_threshold=0` to libx264, killing its own scene-cut detection, so the encoder predicts
across every hard cut and smears for a few frames. That is the bug that shipped in the
1440p hero loop — 4 keyframes for 10 cuts, visible smear at the bridge→cars cut.

So `encode-video.mjs` now:

1. detects cuts on the master (`select='gt(scene,0.25)',showinfo`),
2. passes `-g 50 -force_key_frames "0,<cuts>"` to every opaque encode **and its mobile
   sibling**,
3. reads the I-frame times back out of the finished file and **exits non-zero** if any cut
   is uncovered, with the offending timestamps named.

Verified on `Website Home Loop.mp4`: 12 cuts detected, 12/12 covered, 36 I-frames total.

**Sabotage-tested 2026-08-09** — with the forcing neutered and the check left intact, the
encoder exits 1 and names 2.08s and 3.08s as uncovered. 2.08s is the exact cut from the
original glitch report. A green check here is evidence, not decoration.

Escape hatch: `--no-force-keyframes` on `encode-video.mjs`. There is no good reason to use
it on cut-heavy content.

## Deliberately switched off

Both print a `[skip]` line so their absence is visible rather than silent.

| Thing | Flag to enable | Why it is off |
|---|---|---|
| AVIF/WebP width ladder | `IMAGE_LADDER=1` | nothing consumes it — there is no `<picture>`/srcset renderer, so every sibling would be generated and never requested. Generating output nothing reads is how a pipeline earns distrust. |
| webm + mobile-video manifests | `MEDIA_MANIFESTS=1` | the builders are still in the vault. They **rebuild from a disk scan**, so when they return, CI must set `SKIP_WEBM_MANIFEST=1` or a media-less runner wipes every entry. |

`--sync-r2` is accepted but does nothing useful: `sync-to-store.mjs` is not copied in yet.

## Known rough edges

- **Output is bigger than a hand-tuned encode.** The `loop` preset is CRF 22 / `preset
  medium`; the shipped hero loop was CRF 28 / `veryslow` at 2560px and came in at 8.7 MB.
  The smoke test produced 18.15 MB at 1080p. The presets are tuned for short project loops,
  not a 23-second full-frame background plate. For the hero loop specifically, keep using
  the hand recipe in `media-recipes.md` or add a dedicated preset.
- **Images are copied, not renamed.** The site's convention is `001.jpg, 002.jpg …`; the
  pipeline preserves the master's filename. Rename at intake, or when the ladder lands in
  Phase B.
- **ffprobe here is 4.4.1 while ffmpeg is 6.0.** The keyframe reader accepts both
  `pkt_pts_time` and `pts_time` for that reason. Do not "simplify" it to one.

---

# Phase B — the manifest

Media moved from `src/media/projects/` (bundled by Vite, content-hashed) to
`public/projects/` (copied verbatim, stable paths), and **four** `import.meta.glob` calls
were replaced by one committed manifest.

## Why the glob had to go

`import.meta.glob` is a disk scan performed at build time. It worked only because the media
was committed and therefore present wherever the build ran. The moment media moves to object
storage the scan returns `{}` on the runner — **not an error, just nothing** — and the site
builds green with every gallery empty.

So what exists is computed where the media is, written to `src/data/media-manifest.json`,
and committed. The build reads that file and never looks at the disk.

## What changed

| File | Before | After |
|---|---|---|
| `src/lib/images.js` | globbed `*/*.{jpg,…}` | reads the manifest |
| `src/lib/heroVideo.js` | globbed `*/hero.{mp4,webm}` | reads the manifest |
| `src/lib/compares.js` | globbed `*/compare/*` | reads the manifest |
| `src/lib/aboutImage.js` | globbed `about/*` | reads the manifest |
| `src/lib/mediaManifest.js` | — | **new**: the one owner of manifest reading and URL building |

**Every exported signature is unchanged** — `hasImages`, `getImages`, `getHero`,
`isVideoSrc`, `getHeroVideo`, `getCompares`, `getCompareLabels`, `ABOUT_PORTRAIT` — so no
component was touched. The `hero.mp4` gallery exclusion and the `preferred`-file hero
reordering both survive, and file ordering still uses `localeCompare`, matching the glob.

## Regenerating it

```bash
npm run media:manifest    # rebuild from disk
npm run media:validate    # structural check (no disk needed) — runs as prebuild
npm run media:check       # verify it matches disk (needs the media)
```

You rarely run the first by hand: `process-masters.mjs` refreshes it after every encode, and
the Studio refreshes it after every upload or delete.

## THIS MANIFEST REBUILDS. IT DOES NOT MERGE.

It scans and writes wholesale. Run it where the media tree is incomplete and it records a
near-empty tree and wipes everything else. It refuses to write an empty manifest, and CI
sets `SKIP_REBUILD_MANIFESTS=1` with a `git diff --exit-code` belt in the workflow.

## The guard, and where it had to live

`mediaManifest.js` throws on an empty manifest — but that throw runs in the **browser**, not
during the build. A sabotage test emptied the manifest and **the build went green**, with
the failure deferred to runtime: precisely the bug this whole manifest exists to prevent,
reintroduced one layer up.

The real gate is `npm run media:validate`, wired as npm's `prebuild`, which fails the build
itself. It reads only the manifest, so it is safe on a media-less runner.

Sabotage results, 2026-08-09 — 5/5:

| Sabotage | Result |
|---|---|
| manifest emptied | build RED — "contains ZERO projects" |
| manifest deleted | build RED — "does not exist" |
| manifest corrupted | build RED — "not valid JSON" |
| one project emptied | build RED — names the slug |
| healthy manifest (control) | build GREEN — no false alarm |

**Do not replace `npm run build` with a bare `npx vite build`** anywhere. That skips
`prebuild` and takes the guard with it.

## Proof it works media-less

A copy of the repo containing every tracked file **except** `public/projects/` builds
successfully, and `index.html` plus every JS and CSS bundle are **byte-identical** to the
full-media build. Only the media files differ. That is incident B1 — "the same commit built
two different sites" — closed.

## The tradeoff taken

Project media lost Vite's content-hashed filenames; it now serves from stable paths like
`/projects/asur/002.jpg`. That is the E2 trap: replacing a file's bytes under a long cache
serves the stale version for the whole window. GitHub Pages' cache is short, so this is
survivable now, but **Phase C must add cache tiers by filename** and rename to `-v2` rather
than overwrite.

---

# Phase C — not built

Object storage (Cloudflare R2 recommended, zero egress), `sync-to-store.mjs`, cache tiers by
filename, and `verify-referenced.mjs`. Needs an account Ansh creates. At that point
`public/projects/` becomes gitignored and `VITE_MEDIA_BASE_URL` points at the CDN — the
manifest and every consumer stay exactly as they are.

Full plan: `~/.claude/plans/joyful-sparking-pebble.md`.
