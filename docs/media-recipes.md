# Media recipes and verification gotchas

Moved out of `CLAUDE.md` on 2026-08-09. Read before encoding anything, pulling stills
from a master, or verifying the site in a headless browser.

Tooling note: `ffmpeg` (6.0) and `ffprobe` (4.4.1) are on `PATH` at `~/.local/bin` as of
2026-08-09. The recipes below predate `ffprobe` being available and use `ffmpeg` for
inspection in places; `ffprobe -v quiet -print_format json -show_streams` is now better.

---

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
- **The hero wordmark stays invisible on a warm reload in `npm run dev` — dev-only, not a bug.**
  `main.jsx` wraps the app in `<StrictMode>`, which double-invokes effects on mount. Hero's
  scatter effect guards with `playedRef`: pass 1 sets the flag and builds the timeline, cleanup
  kills it, pass 2 hits the guard and returns early — so the letters sit scattered at
  `opacity: 0` forever. It only bites when `play` is already true at mount (a warm session, i.e.
  `acIntroPlayed` set); on a cold load `play` flips false→true later and the effect runs cleanly.
  **Production is unaffected** — StrictMode doesn't double-invoke in a build. Confirm with
  `npm run build && npx vite preview --port 4173` rather than "fixing" it in dev.

---

## Hero background loop — the forced-keyframe recipe

*Moved from `CLAUDE.md` Conventions on 2026-08-09. This is the single most expensive encode
lesson in the project; do not re-derive it.*

`public/hero-loop.mp4`, **2560×1440 / 8.7 MB** (crf 28, `preset veryslow`), re-encoded from the
4K master `Website Master/Edit/Website Home Loop 03.mp4`; poster regenerated to match at 2560px.

Upgraded from 1080p/7.7 MB: +78% pixels for +1 MB, visibly crisper on retina where the old
1080p was being upscaled. (crf 26 = 12.8 MB and 1080p/crf 22 = 13.9 MB were both worse value;
`veryslow` bought ~4 MB over `slow` at the same crf.)

**Keyframes MUST be forced at the scene cuts.** Modern ffmpeg passes `sc_threshold=0` to
libx264, killing scene-cut detection — the first 1440p encode had only **4 keyframes for 10
hard cuts**, so the encoder predicted *across* each cut and smeared/blocked for a few frames.
That was the reported "glitch at the car bridge frame" (the bridge→cars cut at 2.08/2.16s).

`-x264opts scenecut=40` did **NOT** take. The fix that works:

1. Detect cuts on the master: `select='gt(scene,0.25)',showinfo`
2. Encode with `-g 50 -force_key_frames "0,<cut,list>"`

→ 16 keyframes, every cut covered, same 8.9 MB.

**Re-check after any re-encode:** compare `select=eq(pict_type\,I)` times against the cut list.

## Pulling stills from a master

ffmpeg scene detection (`select='gt(scene,0.3)'`, lower the threshold if too few), then grab a
mid-shot frame per shot. Optimise to ~2000px JPEGs — only downscale, never upscale — and name
them `001.jpg`, `002.jpg` … in `public/projects/<slug>/`.

Historically done with `sips -s format jpeg -s formatOptions 82 -Z 2000`. `sharp` is now
installed as a devDependency and is the better tool for a ladder.

The `smart-stills` skill automates the harvest-and-score half of this.
