#!/usr/bin/env node
/**
 * encode-video.mjs — preset-driven video encoding via ffmpeg.
 *
 * Four named presets cover every delivery scenario the portfolio needs:
 *
 *   loop        H.264 CRF 22, 1080p, NO audio.    ~3-4 Mbps target.
 *               For carousel episodes, hero loops, hover-play tiles,
 *               compare/layers backgrounds. Short autoplay clips with
 *               no spoken/musical audio.
 *
 *   showcase    H.264 CRF 20, 1080p, AAC 192k.   ~6-8 Mbps total.
 *               For standalone "watch this" video blocks. Visually
 *               lossless at typical viewing distance.
 *
 *   hero-2k     H.264 CRF 20, 1440p, AAC 192k.   ~12 Mbps total.
 *               Optional flagship tier for top-of-funnel pieces. Files
 *               are larger; only use when the asset really benefits
 *               (full-frame motion design where every pixel matters).
 *
 *   alpha-loop  WebM (VP9, alpha) + HEVC MP4 (alpha). Transparent loops.
 *               Emits TWO files per master: `.webm` for Chrome/Firefox/
 *               Edge, `.mp4` (HEVC `hvc1`) for Safari/iOS. Renderer
 *               picks the supported source per browser. Skips the
 *               poster JPG (alpha + JPEG = opaque flash on first paint)
 *               and the mobile sibling (alpha encoding is already lean
 *               for short loops).
 *
 * Mobile sibling: pass `--mobile` to also generate a 720p sibling
 * alongside the chosen preset. Browser picks via <source media=
 * "(max-width: 768px)"> automatically. Default off for `loop` /
 * `alpha-loop`, default on for `showcase` / `hero-2k`.
 *
 * Quality numbers come from the 2026-05 sweep design conversation —
 * H.264 chosen over H.265/AV1 for opaque content (universal browser
 * support); HEVC + VP9 only for the alpha-loop case where opacity
 * isn't an option. CRF tuned to balance perceptual quality vs file
 * size for portfolio usage. Tweak knobs at the top of the file if
 * you change your mind.
 *
 * Requires ffmpeg on PATH with libx264, libx265, libvpx-vp9. Install:
 * `brew install ffmpeg` (the homebrew bottle includes all three).
 *
 * Usage:
 *   node scripts/encode-video.mjs --preset loop \
 *        ~/Documents/media-masters/season-one/ep-01.mov \
 *        public/projects/season-one/ep-01.mp4
 *
 *   node scripts/encode-video.mjs --preset showcase --mobile \
 *        ~/Documents/media-masters/season-one/title.mov \
 *        public/projects/season-one/title.mp4
 *   # Also writes public/projects/season-one/title.720p.mp4 for the
 *   # mobile <source> tier.
 *
 *   node scripts/encode-video.mjs --preset alpha-loop \
 *        ~/Documents/media-masters/series-titles/alpha-01.alpha-loop.mov \
 *        public/projects/series-titles/alpha-01.mp4
 *   # Writes BOTH alpha-01.mp4 (HEVC alpha) AND alpha-01.webm (VP9 alpha).
 *   # The output extension you pass is used as the base; the script
 *   # derives sibling extensions per preset.
 *
 *   node scripts/encode-video.mjs --preset hero-2k INPUT OUTPUT
 *   node scripts/encode-video.mjs --list-presets
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, basename, extname, join } from 'node:path';

// Each preset is an array of one or more `encodes`. Single-output presets
// have one entry; multi-output (alpha-loop) has two. The first encode's
// outExt determines the "primary" file — that's what process-masters.mjs
// expects on disk and what the frontmatter URL points at; the renderer
// auto-detects sibling extensions and emits multiple <source> tags when
// they exist.
// Hardware H.264 decoders cap frame WIDTH long before they cap pixel count
// (VideoToolbox and most mobile SoCs stop at 4096). Every preset here scales
// to a fixed HEIGHT with a free width, which is correct for 16:9 and silently
// illegal for anything ultrawide: SUMMIT-2026's 5:1 stage centre
// (5069x1014 master) encoded to 5398x1080, and its phone rung to 4500x900.
// Both are past the ceiling, so the clip decoded nowhere and sat on its
// poster while the 16:9 cells beside it played (reported 2026-08-04).
// 3840 keeps the widest 4K-class frame while staying under every cap we know
// of; anything wider than that on screen is beyond what these blocks render
// at anyway.
const MAX_DECODE_WIDTH = 3840;

/** `scale` expression that targets a height but never exceeds
 *  MAX_DECODE_WIDTH. Width is truncated to an even number (H.264 needs it)
 *  and height rides -2 so it stays even and keeps the source aspect. For any
 *  source narrower than the cap at this height, this is byte-identical to the
 *  old `scale=-2:H`. */
const scaleToHeight = (h) =>
  `scale='trunc(min(iw*${h}/ih\,${MAX_DECODE_WIDTH})/2)*2':-2`;

const PRESETS = {
  loop: {
    description: '1080p H.264 CRF 22, no audio. Short autoplay clips (carousel, hero loops).',
    encodes: [
      {
        outExt: '.mp4',
        args: [
          '-c:v', 'libx264',
          '-crf', '22',
          '-preset', 'medium',
          '-pix_fmt', 'yuv420p',
          '-vf', scaleToHeight(1080),
          '-an',
          '-movflags', '+faststart',
        ],
      },
    ],
    skipPoster: false,
    skipMobile: false,
    // Phone tier ON at 900p (2026-07-29). Loops were the heaviest thing a
    // phone pulled: /work/equals/ 115.7 MB, /work/lnh/ 114.2 MB, 868 MB
    // across the 27 project pages with almost none of it phone-tiered.
    // 900 rather than the 720 default because this is a portfolio and the
    // number was measured, not assumed. VMAF against the ProRes master at an
    // iPhone 15 Pro Max display width (1290px):
    //   desktop 1080p crf22 (what ships)  94.83   100% bytes
    //   900p  crf22                       94.09    67%
    //   720p  crf22                       92.92    40%
    //   1080p crf26                       92.36    50%  <- rejected
    // The 1080p/high-CRF option was the intuitive pick and the worst result:
    // downscaling for display recovers lost resolution but does not hide
    // compression artifacts. the studio owner reviewed all four and chose 900p.
    mobileDefault: true,
    mobileHeight: 900,
  },
  'loop-audio': {
    description: '1080p H.264 CRF 22, AAC 192k. Autoplay loop that KEEPS its audio track so a visible unmute toggle can turn sound on (carousel episodes / loops with meaningful audio).',
    encodes: [
      {
        outExt: '.mp4',
        args: [
          '-c:v', 'libx264',
          '-crf', '22',
          '-preset', 'medium',
          '-pix_fmt', 'yuv420p',
          '-vf', scaleToHeight(1080),
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
        ],
      },
    ],
    skipPoster: false,
    skipMobile: true,
    mobileDefault: false,
  },
  showcase: {
    description: '1080p H.264 CRF 20, AAC 192k audio. Standalone showcase videos.',
    encodes: [
      {
        outExt: '.mp4',
        args: [
          '-c:v', 'libx264',
          '-crf', '20',
          '-preset', 'medium',
          '-pix_fmt', 'yuv420p',
          '-vf', scaleToHeight(1080),
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
        ],
      },
    ],
    skipPoster: false,
    skipMobile: false,
    mobileDefault: true,
  },
  'hero-2k': {
    description: '1440p H.264 CRF 20, AAC 192k. Flagship tier for premium pieces.',
    encodes: [
      {
        outExt: '.mp4',
        args: [
          '-c:v', 'libx264',
          '-crf', '20',
          '-preset', 'slow',
          '-pix_fmt', 'yuv420p',
          '-vf', scaleToHeight(1440),
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
        ],
      },
    ],
    skipPoster: false,
    skipMobile: false,
    mobileDefault: true,
  },
  'alpha-loop': {
    description: '1080p WebM (VP9, alpha) + HEVC MP4 (alpha). Transparent loops, dual encode.',
    encodes: [
      // HEVC MP4 first — primary output (what the frontmatter URL
      // references). Safari + iOS consume this. The hvc1 tag is REQUIRED
      // for QuickTime / Safari to play HEVC; without it the file plays
      // on Chrome but Safari rejects it.
      //
      // Encoder choice — `hevc_videotoolbox` over `libx265`:
      // libx265 is the obvious pick but most pre-built libx265
      // distributions (homebrew, Linux distro packages) don't compile in
      // alpha layer support — they fail with "Loaded libx265 does not
      // support alpha layer encoding". Apple's `hevc_videotoolbox`
      // ships with macOS, has working alpha encoding (Big Sur 11.0+),
      // and runs on the Apple Silicon HW encoder so it's fast. Trade-off:
      // this preset only works on macOS. Linux users who want to encode
      // alpha-loops would need to either install a libx265 with alpha
      // support manually or use a different encoder. Acceptable since
      // this site's pipeline runs on the author's Mac, not in CI.
      //
      // `-allow_sw 1` lets ffmpeg fall back to software encoding if the
      // hardware encoder can't handle a particular input (e.g. unusual
      // dimensions). `-q:v 60` is the videotoolbox quality knob (0-100,
      // higher = better; 60 is roughly equivalent to libx265 CRF 22 in
      // perceptual terms).
      {
        outExt: '.mp4',
        args: [
          '-c:v', 'hevc_videotoolbox',
          '-tag:v', 'hvc1',
          '-pix_fmt', 'yuva420p10le',
          '-allow_sw', '1',
          '-alpha_quality', '0.75',
          '-q:v', '60',
          '-vf', scaleToHeight(1080),
          '-an',
          '-movflags', '+faststart',
        ],
      },
      // WebM VP9 — sibling output. Chrome / Firefox / Edge consume this.
      // VP9 with alpha is well-supported across all major non-Safari
      // browsers; -auto-alt-ref 0 is required for alpha (the default
      // alt-ref frames don't carry alpha and produce broken output).
      {
        outExt: '.webm',
        args: [
          '-c:v', 'libvpx-vp9',
          '-pix_fmt', 'yuva420p',
          '-b:v', '2M',
          '-auto-alt-ref', '0',
          '-vf', scaleToHeight(1080),
          '-an',
        ],
      },
    ],
    // Skip poster JPG: alpha + JPEG can't represent transparency, so the
    // poster would render as an opaque rectangle of the last frame's
    // composite-against-black, flashing before the video loads. Better
    // to render the page background while the (small) alpha video loads.
    skipPoster: true,
    // Skip mobile sibling: alpha encoding is already lean for the short
    // loops this preset is designed for, and dual-encoding both desktop
    // AND mobile tiers would quadruple the encode time for marginal
    // gain.
    skipMobile: true,
    mobileDefault: false,
  },
};

const MOBILE_HEIGHT_DEFAULT = 720;
const mobileSuffixFor = (h) => `.${h}p`;
const mobileVfFor = (h) => scaleToHeight(h);

function parseArgs(argv) {
  const args = { _: [], preset: 'showcase', mobile: false, dryRun: false, listPresets: false, forceKeyframes: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--preset') args.preset = argv[++i];
    else if (a === '--mobile') args.mobile = true;
    else if (a === '--no-mobile') args.mobile = 'off';
    else if (a === '--no-force-keyframes') args.forceKeyframes = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--list-presets') args.listPresets = true;
    else if (a === '--help' || a === '-h') args.listPresets = true;
    else args._.push(a);
  }
  return args;
}

function listPresets() {
  console.log('Available presets:\n');
  for (const [name, def] of Object.entries(PRESETS)) {
    console.log(`  ${name.padEnd(12)} ${def.description}`);
    const exts = def.encodes.map((e) => e.outExt).join(' + ');
    console.log(`               outputs: ${exts}`);
    console.log(`               poster:  ${def.skipPoster ? 'skipped' : 'auto last-frame JPG'}`);
    console.log(`               mobile sibling default: ${def.mobileDefault ? `on (${def.mobileHeight ?? MOBILE_HEIGHT_DEFAULT}p)` : 'off'}\n`);
  }
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function runFfmpeg(args, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] ffmpeg ${args.map((a) => (a.includes(' ') ? `'${a}'` : a)).join(' ')}`);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    child.on('error', (err) => {
      reject(new Error(`ffmpeg failed to start (is it on PATH? see docs/media-recipes.md — ffmpeg lives at ~/.local/bin, there is no Homebrew on this machine). ${err.message}`));
    });
  });
}

// ─── Scene-cut keyframe forcing ──────────────────────────────────────────────
// ADDED 2026-08-09, not in the upstream pack. The pack's presets place no
// keyframes at scene cuts, and modern ffmpeg passes sc_threshold=0 to libx264,
// which kills its own scene-cut detection. The encoder then predicts ACROSS
// every hard cut and smears/blocks for a few frames after each one.
//
// This is not hypothetical here: the 1440p hero loop shipped with 4 keyframes
// for 10 hard cuts and visibly smeared at the bridge->cars cut (2.08s).
// `-x264opts scenecut=40` does NOT override it. Forcing the keyframes does.
// Full write-up: docs/media-recipes.md.
const SCENE_THRESHOLD = 0.25;

/** Detect hard-cut timestamps in a master. Returns seconds, ascending. */
function detectSceneCuts(input) {
  return new Promise((resolve) => {
    // NOTE: showinfo logs at INFO level. Do NOT add `-v error` — it suppresses
    // the very output being parsed and yields an empty list, which reads as
    // "this master has no cuts" and silently disables the whole guard.
    const child = spawn('ffmpeg', [
      '-i', input,
      '-vf', `select='gt(scene,${SCENE_THRESHOLD})',showinfo`,
      '-f', 'null', '-',
    ]);
    let buf = '';
    child.stderr.on('data', (d) => { buf += d.toString(); });
    child.on('close', () => {
      const times = [...buf.matchAll(/pts_time:([0-9.]+)/g)]
        .map((m) => Number(m[1]))
        .filter((t) => Number.isFinite(t) && t > 0)
        .sort((a, b) => a - b);
      resolve(times);
    });
    child.on('error', () => resolve([]));   // fail open: encode without forcing
  });
}

/** Inject `-g` + `-force_key_frames` into a preset's arg list. */
function withForcedKeyframes(args, cuts) {
  if (!cuts.length) return args;
  return [...args, '-g', '50', '-force_key_frames', `0,${cuts.join(',')}`];
}

/** Read I-frame timestamps out of an encoded file. */
function readKeyframeTimes(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'quiet', '-select_streams', 'v', '-show_frames', '-of', 'json', file,
    ]);
    let buf = '';
    child.stdout.on('data', (d) => { buf += d.toString(); });
    child.on('close', () => {
      try {
        const frames = JSON.parse(buf).frames ?? [];
        resolve(frames
          // ffprobe 4.x calls this pkt_pts_time; 5+/6 also expose pts_time.
          // Read both or this silently returns an empty list on one of them,
          // and an empty list would read as "no keyframes" — a false alarm
          // that would abort every good encode. (Bitten 2026-08-09: this
          // machine pairs ffmpeg 6.0 with ffprobe 4.4.1.)
          .filter((f) => f.pict_type === 'I')
          .map((f) => Number(f.pkt_pts_time ?? f.pts_time))
          .filter(Number.isFinite)
          .sort((a, b) => a - b));
      } catch (err) {
        reject(new Error(`could not parse ffprobe output for ${file}: ${err.message}`));
      }
    });
    child.on('error', reject);
  });
}

/**
 * Assert that every detected cut got a keyframe. This is the whole point of
 * the forcing above, so it is checked against the ACTUAL BYTES ON DISK rather
 * than assumed from the fact that ffmpeg exited 0.
 *
 * Tolerance is one frame at 25fps. A cut with no keyframe within that window
 * means the encoder is predicting across it and will smear.
 */
async function verifyKeyframes(file, cuts, { tolerance = 0.041 } = {}) {
  if (!cuts.length) return;
  const kf = await readKeyframeTimes(file);
  if (!kf.length) {
    throw new Error(`no keyframes readable in ${file} — cannot verify the scene-cut guard`);
  }
  const missed = cuts.filter((c) => Math.min(...kf.map((k) => Math.abs(c - k))) > tolerance);
  if (missed.length) {
    throw new Error(
      `${missed.length} of ${cuts.length} scene cut(s) have NO keyframe in ${file}: ` +
      `${missed.map((t) => t.toFixed(2)).join(', ')}\n` +
      `The encoder will predict across those cuts and smear. Do not ship this file.`,
    );
  }
  console.log(`[encode-video] keyframe check: ${cuts.length}/${cuts.length} cuts covered (${kf.length} I-frames total)`);
}

function withMobileSuffix(outPath, height = MOBILE_HEIGHT_DEFAULT) {
  const ext = extname(outPath);
  const stem = outPath.slice(0, -ext.length);
  return `${stem}${mobileSuffixFor(height)}${ext}`;
}

/** Sibling poster JPG path: `ep-01.mp4` -> `ep-01-poster.jpg`. */
function withPosterSuffix(outPath) {
  const ext = extname(outPath);
  const stem = outPath.slice(0, -ext.length);
  return `${stem}-poster.jpg`;
}

/** Swap the extension of an output path. Used so multi-encode presets
 *  can emit several siblings (`.mp4` + `.webm`) from one base output
 *  path. */
function withExt(outPath, newExt) {
  const ext = extname(outPath);
  const stem = outPath.slice(0, -ext.length);
  return `${stem}${newExt}`;
}

function replaceVfScale(args, newScale) {
  // Replace the `-vf scale=-2:NNNN` flag so the mobile sibling uses
  // the 720p line. Idempotent — if no -vf is present we just append.
  const out = [];
  let i = 0;
  let replaced = false;
  while (i < args.length) {
    if (args[i] === '-vf' && i + 1 < args.length) {
      out.push('-vf', newScale);
      i += 2;
      replaced = true;
    } else {
      out.push(args[i]);
      i += 1;
    }
  }
  if (!replaced) out.push('-vf', newScale);
  return out;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.listPresets) {
    listPresets();
    return;
  }

  const preset = PRESETS[args.preset];
  if (!preset) {
    console.error(`Unknown preset: ${args.preset}`);
    listPresets();
    process.exit(1);
  }

  const [input, output] = args._;
  if (!input || !output) {
    console.error('Usage: node scripts/encode-video.mjs --preset <name> INPUT OUTPUT [--mobile] [--dry-run]');
    console.error('       node scripts/encode-video.mjs --list-presets');
    process.exit(1);
  }

  if (!existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  const outDir = dirname(output);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // Mobile sibling decision: explicit --mobile / --no-mobile wins,
  // otherwise fall back to the preset's default. Presets that disable
  // mobile entirely (alpha-loop) skip this regardless.
  const wantMobile = preset.skipMobile
    ? false
    : (args.mobile === 'off' ? false : (args.mobile === true || preset.mobileDefault));

  const srcBytes = existsSync(input) ? statSync(input).size : 0;
  console.log(`\n[encode-video] preset=${args.preset}  encodes=${preset.encodes.length}  mobile=${wantMobile ? 'yes' : 'no'}  poster=${preset.skipPoster ? 'no' : 'yes'}`);
  console.log(`  in:  ${input}  (${fmtBytes(srcBytes)})`);
  for (const enc of preset.encodes) {
    console.log(`  out: ${withExt(output, enc.outExt)}`);
  }
  if (!preset.skipPoster) console.log(`  out: ${withPosterSuffix(output)}  (last-frame poster JPG)`);
  if (wantMobile) {
    const mh = preset.mobileHeight ?? MOBILE_HEIGHT_DEFAULT;
    console.log(`  out: ${withMobileSuffix(output, mh)}  (mobile sibling, ${mh}p)`);
  }
  console.log('');

  // Run each encode in series. We don't parallelise because ffmpeg is
  // already CPU-saturating on a single encode; running two at once on
  // the same machine would just thrash. For the alpha-loop preset the
  // HEVC encode runs first (slow, x265-preset=medium), then VP9.
  // Detect the hard cuts ONCE, before any encode, and force a keyframe at each.
  // Skipped for alpha-loop: those are short transparent loops on different
  // codecs, and the pack notes the extra passes are not worth it there.
  let cuts = [];
  if (args.forceKeyframes && args.preset !== 'alpha-loop') {
    cuts = await detectSceneCuts(input);
    if (cuts.length) {
      console.log(`[encode-video] ${cuts.length} scene cut(s) detected — forcing a keyframe at each`);
      console.log(`               ${cuts.map((t) => t.toFixed(2)).join(' ')}`);
    } else {
      console.log('[encode-video] no scene cuts detected above threshold — encoding without forced keyframes');
    }
  }

  for (const enc of preset.encodes) {
    const encOutPath = withExt(output, enc.outExt);
    const encArgs = ['-i', input, '-y', ...withForcedKeyframes(enc.args, cuts), encOutPath];
    await runFfmpeg(encArgs, args.dryRun);
    // Fail loud on a truncated / empty encode (ffmpeg failed or was killed
    // mid-write). Otherwise the 0-byte mp4/webm is mtime-newer than the master,
    // so process-masters skips re-encoding it and sync-to-r2 uploads it as
    // "current" — a broken video that serves 200 with no <source> fallback.
    // Mirrors the poster guard below.
    if (!args.dryRun && (!existsSync(encOutPath) || statSync(encOutPath).size === 0)) {
      throw new Error(`encode produced no/empty output: ${encOutPath} (ffmpeg likely failed or was killed mid-write)`);
    }
    // Prove the scene-cut guard actually took. ffmpeg exiting 0 is not evidence.
    if (!args.dryRun && enc.outExt === '.mp4') {
      await verifyKeyframes(encOutPath, cuts);
    }
  }

  // Last-frame poster sibling. `-sseof -0.05` seeks 50ms before EOF;
  // ffmpeg snaps to the nearest decodable frame, which lands on the
  // final visible frame for ~3-second clips. `-q:v 3` is a tasteful
  // JPG quality (lower = better; 1-2 is largely indistinguishable from
  // raw, 3 trims a few KB without visible artifacts at thumb scale).
  // Output goes alongside the MP4 as `<name>-poster.jpg`. The renderer
  // picks it up via `<video poster="...">` so the carousel thumb +
  // (potentially) any other poster-aware consumer can show the final
  // frame instantly without waiting for video metadata.
  //
  // Hand-picked posters are PRESERVED: a poster file NEWER than the
  // master means an author dropped their own frame over the generated
  // one — re-encoding the video must not clobber it. (A re-cut master
  // is newer than the old custom poster, so it regenerates; re-drop the
  // custom frame after a re-cut.)
  if (!preset.skipPoster) {
    const posterPath = withPosterSuffix(output);
    const masterMtime = statSync(input).mtimeMs;
    if (existsSync(posterPath) && statSync(posterPath).mtimeMs > masterMtime) {
      console.log(`[encode-video] poster kept (newer than master, likely hand-picked): ${posterPath}`);
    } else {
      const posterArgs = ['-sseof', '-0.05', '-i', input, '-frames:v', '1', '-q:v', '3', '-y', posterPath];
      await runFfmpeg(posterArgs, args.dryRun);
      // ffmpeg exits 0 with "nothing was encoded" on inputs whose final
      // 50ms doesn't decode (some VFR exports) — that left a silent hole
      // where a poster should be. Fail loudly instead.
      if (!args.dryRun && (!existsSync(posterPath) || statSync(posterPath).size === 0)) {
        throw new Error(`poster extraction produced no file: ${posterPath} — try a manual -sseof value (e.g. -0.5)`);
      }
    }
  }

  // Mobile sibling — only for the FIRST encode in a multi-encode preset
  // (i.e. the primary .mp4 for any preset that has multiple). Authors
  // who really want a mobile sibling for the .webm too can re-run the
  // encoder manually; in practice no project to date has wanted this.
  if (wantMobile) {
    const primaryEnc = preset.encodes[0];
    const primaryOutPath = withExt(output, primaryEnc.outExt);
    const mobileH = preset.mobileHeight ?? MOBILE_HEIGHT_DEFAULT;
    const mobileArgs = ['-i', input, '-y', ...withForcedKeyframes(replaceVfScale(primaryEnc.args, mobileVfFor(mobileH)), cuts), withMobileSuffix(primaryOutPath, mobileH)];
    await runFfmpeg(mobileArgs, args.dryRun);
  }

  if (!args.dryRun) {
    for (const enc of preset.encodes) {
      const encOutPath = withExt(output, enc.outExt);
      const outBytes = statSync(encOutPath).size;
      console.log(`[encode-video] ${encOutPath} -> ${fmtBytes(outBytes)} (${((outBytes / srcBytes) * 100).toFixed(1)}% of source)`);
    }
    if (wantMobile) {
      const primaryOutPath = withExt(output, preset.encodes[0].outExt);
      const mh = preset.mobileHeight ?? MOBILE_HEIGHT_DEFAULT;
      const mobBytes = statSync(withMobileSuffix(primaryOutPath, mh)).size;
      console.log(`[encode-video] ${withMobileSuffix(primaryOutPath, mh)} -> ${fmtBytes(mobBytes)}`);
    }
    // Warn on any encode > 10 MB (the soft "is this too big?" threshold).
    for (const enc of preset.encodes) {
      const encOutPath = withExt(output, enc.outExt);
      const outBytes = statSync(encOutPath).size;
      if (outBytes > 10 * 1024 * 1024) {
        console.log(`\n[encode-video] WARNING: ${encOutPath} > 10 MB. Consider trimming the source or using a tighter preset.`);
      }
    }
  }
}

main().catch((err) => {
  console.error(`\n[encode-video] ${err.message}`);
  process.exit(1);
});

// Suppress unused-var lint when running a fresh build — `basename` is
// reserved for future logging refinement.
void basename;
void join;
