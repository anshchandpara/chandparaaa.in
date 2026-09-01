# Lessons — one dated line per surprise, with evidence

Append-only, newest first. This is where the system learns. A lesson without evidence is an
opinion; cite what proved it.

---

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
