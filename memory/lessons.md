# Lessons — one dated line per surprise, with evidence

Append-only, newest first. This is where the system learns. A lesson without evidence is an
opinion; cite what proved it.

---

**2026-09-11 · A slice-and-replace edit removes everything between its two markers, and a
verification that only checks what was ADDED will pass while the removal ships.** Rewriting the
controls-legend CSS as `s[:start] + new + s[end:]` from the legend marker to the fallback marker
also deleted `.rv__focus`, `.rv__corner`, `.rv__index`, `.rv__controls` and `.rv__btn`, which
sat between them. The check that followed measured the popup and the legend — the new things —
and the unstyled ‹ › × buttons went live in `c47572d`.
*Evidence:* `grep -n "^\.rv" Reveries.css` after the edit listed none of those selectors, and
`git show main:…` confirmed they were gone on the live branch. Rule from it: after any block
replacement, diff the SELECTOR LIST before and after (`grep '^\.' | sort`), not just the
feature you meant to touch. Restored the same day, alongside the zoom work.

**2026-09-12 · `curl -I` says DYNAMIC on an object that GET serves as a HIT.** Probing the
new edge Cache Rule with HEAD showed `cf-cache-status: DYNAMIC` three times in a row; the same
object by GET was MISS → HIT → HIT, and a still cached eight minutes earlier reported `age: 499`.
Cloudflare does not store or report HEAD the way it does GET.
*Evidence:* `curl -s -o /dev/null -D - <url> | grep cf-cache-status` versus `curl -sI`. Probe
caches with the verb the browser uses.

**2026-09-12 · Resource Timing sizes are 0 for every cross-origin load unless the origin sends
`Timing-Allow-Origin` — so "transferSize 0" means "hidden", not "blocked".** After moving media
to `media.chandparaaa.in`, a check counting `transferSize===0` reported 51 "CORS failures" on
a page with no console errors and 51 textures visibly loaded. r2.dev had exposed the sizes;
the custom domain does not.
*Evidence:* `performance.getEntriesByType('resource')` showed 61 entries from the new host,
all with 0 sizes, while the scene held 61/61 textures with `naturalWidth > 0`. Judge loads by
the thing that loaded (image dimensions, texture state), never by timing sizes across origins.

**2026-09-11 · A CORS policy added AFTER a browser has cached the object does not reach that
browser: it keeps serving the headerless copy for the full cache lifetime.** R2 project media
is `Cache-Control: max-age=2592000, must-revalidate` — 30 days fresh. The preview browser had
loaded the Reveries textures before the policy existed; after it was set, 14 pieces rendered
and 2 still failed with "No Access-Control-Allow-Origin", while a fresh `curl` showed the
header present.
*Evidence:* `fetch(url, {{mode:'cors', cache:'reload'}})` on all 32 objects → 32/32 ok, and the
next page load showed 16/16. The console's cumulative error log also kept showing the OLD
failures across reloads — read the resource entries or the scene, not the console count.
→ `HANDOFF.md`, ship log

**2026-09-11 · WebGL textures need CORS; `<img>` tags do not — so a bucket that has served
every image on the site for weeks can still block the first three.js texture.** The R2 public
bucket sends no `Access-Control-Allow-Origin`. Browsers happily paint a cross-origin image into
an `<img>`, but refuse to upload a "tainted" one to a WebGL texture, so `TextureLoader` fails on
all 16 Reveries pieces with a CORS error while the same URLs work everywhere else.
*Evidence:* `curl -sI -H "Origin: https://chandparaaa.in" <r2 url>` returns 200 with no
`access-control-*` header; `GetBucketCors` via the S3 API returns `AccessDenied` — the R2 token
has object scope, not bucket-config scope, so this cannot be fixed from the pipeline. It is a
Cloudflare dashboard setting (R2 → bucket → Settings → CORS). For local verification only,
`VITE_MEDIA_BASE_URL= npm run build` points a production build at `public/` — never ship that
build. → `src/components/lab/reveriesScene.js`

**2026-09-11 · `applyDesign()` writes `--bg` as an INLINE style on `<html>`, which no stylesheet
selector can beat.** A scoped light theme via `body.theme-light { --bg: #fff }` made the body
white but left `<html>` dark, showing as a dark flash on macOS overscroll. `:root:has(body.theme-light)`
demonstrably matched (`html.matches()` → true) and still lost.
*Evidence:* `getComputedStyle(html).getPropertyValue('--bg')` stayed `#0a0a0a` with the rule
present in the built CSS. `lib/design.js` sets root custom properties with `style.setProperty`;
inline beats everything but `!important`. The page that opts in now sets html's `--bg` from JS
and restores it on unmount. → `src/components/lab/Reveries.jsx`

**2026-09-10 · You cannot detect text overflow by reading the element's own width —
a shrink-to-fit box is CLAMPED to its container, so the measurement can never exceed it.**
`.pd__title` is `overflow: hidden` (the clip mask the title rise animates out of), and that
mask crops HORIZONTALLY as well as vertically — CSS gives no vertical-only overflow. A single
word wider than the column therefore got guillotined: `MANORATHANGAL` rendered as `MANORAT`
at 129.6px in a 569px column, 501px of the word simply gone, live on production.
*Evidence:* the first fix tested `span.getBoundingClientRect().width > box.clientWidth` and
never fired — measured box 1123px, reported span width 1123px, actual canvas ink 1149px. The
span is inline-block inside a BFC, so its used width is capped at the available width and the
glyphs paint outside it; that is INK overflow, not layout overflow, and `scrollWidth` does not
reliably see it either. The working test measures the widest WORD at max-content in an
offscreen twin with `white-space: pre` — words are what cannot break, so they are the real
constraint. → `src/hooks/useTitleFit.js`

**2026-09-10 · A CSS custom-property fallback belongs in `var()`, never as its own
declaration — a declaration on the child BEATS the value inherited from the parent.**
`.pd__hero-video` carried `aspect-ratio: var(--video-aspect, 1.7778)` but an earlier version
declared `--video-aspect: 1.7778` on that element. Inheritance never got a chance: every film
silently rendered 16:9, and Equals (2.393 scope) was cropped ~13% a side. It looks like a
working fallback right up until you check a non-16:9 film.
*Evidence:* the fix was to delete the declaration and keep the fallback inside `var()`. The
same pattern is now load-bearing on `.pd__film-frame`, which is why the warning was moved
there when `.pd__hero-video` was removed as dead code on 2026-09-10.
→ `docs/design-state.md`, grep "video-aspect"

**2026-09-01 · Vimeo player URLs return 401 to curl no matter what, so never conclude an
embed is broken from the command line.** `player.vimeo.com/video/<id>` returned 401 with no
Referer, with `Referer: chandparaaa.in`, and with a full Safari User-Agent — while a public
control video returned 200. The body says "We couldn't verify the security of your
connection… Access to this content has been restricted", which reads exactly like a privacy
or domain restriction.
*Evidence:* the same URL loads perfectly in a real browser — full player, correct title,
00:47. It is Vimeo's anti-bot layer, not the video's settings. Verify embeds in the browser
pane; a 401 from curl is not a finding. → incident A4

**2026-09-01 · Untracking a directory + a branch-switching ship script DELETES the local
files.** `public/projects/` was untracked and gitignored, then `npm run ship` ran. ship.sh does
`git checkout main` -> ff-merge -> `git checkout dev`; main still tracked the media at checkout
time, so advancing past the deletion commit made git remove all 273 files from the working
tree. **.gitignore does not protect files git was already tracking.**
*Evidence:* `public/projects` absent from disk immediately after a successful ship, while R2
still held 273/273. Nothing was lost — but local dev serves 404s until restored, because dev
deliberately reads from disk rather than the CDN.
*What now inherits the fix:* `npm run media:pull` restores from the bucket, and is also what a
fresh clone needs. The manifest builder's refuse-on-missing-tree guard did its job here — it
declined to regenerate from the empty directory rather than writing an empty manifest and
wiping every entry. → `docs/media-pipeline.md`

**2026-08-09 · A guard in the wrong layer is not a guard: a runtime `throw` cannot fail a
build.** `src/lib/mediaManifest.js` throws on an empty manifest, which felt like enough.
Sabotage-testing it — emptying the manifest and building — produced **exit 0**. Vite bundles
the module, it does not execute it, so the throw only fires in the browser. The build stayed
green and the failure moved to runtime, which is the exact bug the manifest exists to
prevent.
*Evidence:* the fix is `npm run media:validate` wired as npm's `prebuild`, which reads the
manifest in Node and exits non-zero. Re-tested: 5/5 sabotage cases red, control green.
**Never replace `npm run build` with `npx vite build`** — that skips `prebuild`.
→ `docs/media-pipeline.md`

**2026-08-09 · Moving media broke the Studio silently, because two more globs existed than
the plan named.** The plan named `images.js` and `heroVideo.js`. A grep found **four**
globs — `compares.js` and `aboutImage.js` too — plus `tools/vite-admin-plugin.js` writing
uploads to `src/media/projects`, which would have made every Studio upload vanish with no
error.
*Evidence:* `grep -rn "import.meta.glob" src/` and
`grep -n "src/media" tools/vite-admin-plugin.js`. Survey before migrating; the plan is a
hypothesis about the codebase, not a description of it.

**2026-08-09 · `ffprobe` 4.4.1 has no `pts_time` field, and asking for it fails
*silently*.** `-show_entries frame=pict_type,pts_time -of csv` returns rows with no
timestamp; a `cut -d, -f2 | awk '{printf "%.2f"}'` then parses the pict_type letter as a
number and prints `0.00` for every frame. That reads as "every keyframe is at zero"
rather than "that field does not exist on this version".
*Evidence:* `ffprobe … -of json | jq '.frames[0]|keys'` lists `pkt_pts_time`, not
`pts_time`. The pipeline's reader now accepts `.pkt_pts_time // .pts_time` and must not be
"simplified". This machine pairs ffmpeg 6.0 with ffprobe 4.4.1. → `durable-toolchain` memory

**2026-08-09 · The upstream pipeline forces no keyframes at all, so adopting it as-shipped
would have reintroduced the hero-loop smear.** Grepping the whole of
`04-media-pipeline/scripts/` for `force_key|scenecut|sc_threshold|keyint` returned nothing.
*Evidence:* sabotage test — with forcing neutered and the new check left intact, the encoder
exits 1 and names **2.08s** as uncovered, which is the exact cut from the original glitch
report. Guard now lives in `tools/pipeline/encode-video.mjs`. → `docs/media-pipeline.md`

**2026-08-09 · A pack's own integrity check can have a blind spot, so read what you
install.** `studio-systems-pack/check-pack.mjs` reports "every local markdown link
resolves" and exits clean — but `beat-edit`'s YAML `description` pointed at
`references/project-worked-example.md` while the actual file is `worked-example.md`. The
checker only validates markdown-syntax links, not paths named in frontmatter, so a skill
shipped advertising a reference that does not exist.
*Evidence:* `grep -o "references/[a-z-]*\.md" beat-edit/SKILL.md` versus `ls
beat-edit/references/`. Fixed on install. → the pack's own warning: "a skill you did not
write and do not read is a set of instructions you have delegated to a stranger"

**2026-08-09 · `showinfo` logs at info level, so `-v error` silently returns zero cuts.**
Running the documented scene-detection recipe with `-v error` printed nothing, which reads
exactly like "this master has no hard cuts". It has 12, the first at 2.08s.
*Evidence:* same command without `-v error` returns
`2.08 3.08 3.20 4.04 4.20 5.96 6.84 8.80 11.92 12.92 15.44 16.60`. That first value is the
bridge→cars cut named in the original glitch report — independent confirmation of the
encode lesson below. → incident A4, "an empty result from a tool you have not verified is
not a finding"

**2026-08-09 · A tool in `/tmp` is not an installed tool.** `ffmpeg` lived at
`/tmp/node_modules/ffmpeg-static/ffmpeg` and vanished on every reboot; `ffprobe` was never
installed at all, so delivery specs were checked by eye. Both now live under `~/.local/`.
*Evidence:* the reinstall instruction was written into `CLAUDE.md` as a permanent quirk, which
is the tell — a workaround documented as an environment fact. → rule R5

**2026-08-09 · Two files describing the same state will disagree, and the newer one is not
reliably right.** `chandparaaa-handoff.md` claimed 22 published projects while `CLAUDE.md`'s
own pending list and the newest commit disagreed. Both were being read as authoritative.
*Evidence:* commit `6940c1c` hid `reel-edit-2026` after the handoff was written. → the reason
this `memory/` directory exists

**2026-08 · `sc_threshold=0` kills libx264 scene-cut detection, and `-x264opts scenecut=40`
does not override it.** The first 1440p hero encode had 4 keyframes for 10 hard cuts, so the
encoder predicted across every cut and smeared for a few frames.
*Evidence:* the visible glitch at the bridge→cars cut, 2.08/2.16s. Fix is to detect cuts on the
master and pass `-force_key_frames` explicitly → 16 keyframes, same 8.9 MB.
→ `docs/media-recipes.md`

**2026-08 · ScrollTrigger and IntersectionObserver both react only to a *crossing*, never to a
state.** Anything that moves an element from below the fold to above it in one jump — fast
scroll, anchor jump, re-sort, appended batch, column change — produces no event, and the
element stays invisible forever.
*Evidence:* the "cards aren't loading" bug. → `memory/decisions.md`

**2026-08 · React StrictMode's double-invoke turns a `playedRef` guard into a permanent
no-op.** Pass 1 sets the flag and builds the timeline, cleanup kills it, pass 2 hits the guard
and returns early — leaving the letters scattered at `opacity: 0`. It only bites when `play` is
already true at mount (a warm session with `acIntroPlayed` set).
*Evidence:* **production is unaffected** — StrictMode does not double-invoke in a build.
Confirm with `npm run build && npx vite preview --port 4173` rather than "fixing" it in dev.
→ `docs/media-recipes.md`

**2026-07-25 · Attaching a custom domain to GitHub Pages before DNS resolves means no
certificate is ever requested.** It does not retry. `https_certificate: null` and the wildcard
`*.github.io` cert gets served indefinitely.
*Evidence:* fix is to detach and re-attach the domain via the API (`PUT /pages` with
`cname:null`, then the domain again) — issuance starts immediately. → `CLAUDE.md`, "Deployment"

**2026-08-07 · Deleting code is safe only after proving zero references.** `Contact.jsx` and
`Contact.css` were removed only after verifying no imports across the tree — `AboutPage.jsx`
uses the `AboutContact` named export from `About.jsx`, not the standalone file. The dead file
also carried a stale `hello@anshchandpara.com` and `href="#"` socials that would have been
embarrassing if they had ever rendered.
*Evidence:* this is the standard to match under rule R3, not an exception to it.

**2026-08-07 · A source folder can empty out between sessions.** `MVs/hASHISHBHAI` was recorded
as the master location for `hashishbhai-dhanji-rasla`; on re-check it was empty.
*Evidence:* verify a master still exists before planning work around it.

**2026-09-12 · The preview pane throttles CSS transitions, not just rAF.** A hovered hero
letter read opacity 0.04 / wght 393 a full second after its 0.2 s transition should have
ended (target 0.98 / 716). Inject `transition: none !important` before reading computed
styles, or you are reading mid-flight.
*Evidence:* Hero.jsx pocket check, session e84d216e.

**2026-09-12 · "yes do it" means build it, not ship it.** Shipped the brand hover flip on
that phrase alone, calling it "the same feature" as the batch Ansh had said ship for. It
was not — and it went live with a reflow jitter he then had to report. R1 is literal: the
word is "ship", per change.
*Evidence:* commit shipping "Brand: letters flip…", then "nav brand animation is not smooth at all".

**2026-09-12 · A per-letter weight morph must happen in a fixed cell.** Left inline, a
heavier glyph pushes every letter after it sideways — 3.6px at 16px, measured — and the line
shivers for the length of the transition. Pin each letter to the wider of its two cuts
(`Brand.jsx`); then the only thing that moves is the strokes (0.000px shift, measured).
*Evidence:* Brand.jsx `pin()`; preview measurement 2026-09-12.

**2026-09-21 · The preview pane pauses media it cannot see.** A muted loop started by
`play()` resolved `paused === false`, then read paused a second later — the pane's document is
hidden and Chrome pauses background media. Not a bug in the code: the same page in headless
Chrome at 375px played the in-view loops and paused them on scroll-away. Verify media playback
with the CDP probe, not the pane.
*Evidence:* `useInViewPlayback` debug run, session e84d216e.
