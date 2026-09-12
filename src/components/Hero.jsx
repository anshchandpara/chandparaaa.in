import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useMagnetic } from '../hooks/useMagnetic';
import LocationMap from './LocationMap';
// Hero background loop — muted, self-hosted in /public. Shared with the Landing
// gate (lib/heroVideo.js) so both play the same cached file.
import { HERO_VIDEO, HERO_POSTER } from '../lib/heroVideo';
// Lab-mode cover — Ansh's own ornamental drawing (replaces a stock photo).
import LAB_IMG from '../media/lab/lab-cover.jpg';
import { scrambleLetters, randomGlyph } from '../lib/glitch';
import { randomWeight, oppositeWeight } from '../lib/weights';
import './Hero.css';

const WORDMARK = 'Chandparaaa';
const LETTERS = WORDMARK.split('');
const TAIL = 3; // the trailing "aaa" — these resolve last

// The reveal is LOCAL: each letter's intensity comes from its own distance to
// the cursor, falling to 0 at this radius. Only letters inside it react — at
// rest the wordmark is its outline (the ghost layer) and nothing else.
const RADIUS = 150;

const COPY = {
  work: {
    eyebrow: 'Creative Director · Title Designer · Filmmaker',
    sub: 'Selected work across title design, film, music videos, and brand storytelling.',
    cta: 'View work',
  },
  lab: {
    eyebrow: 'Experiments · Studies · Sketches',
    sub: 'An open archive of experiments — process over polish, kept in its raw state.',
    cta: 'Browse experiments',
  },
};

export default function Hero({ mode = 'work', play = true }) {
  const lettersRef = useRef([]);
  const ghostRef = useRef([]); // stroke-only ghost layer, desynced from the base
  const subRef = useRef(null);
  const wordRef = useRef(null);
  const playedRef = useRef(false);
  const readyRef = useRef(false); // true once the decode has resolved
  // One random cut per letter on the weight axis, drawn once per mount. Hero.css
  // morphs each letter from its cut to the opposite one as the cursor nears;
  // the ghost gets the same pair so outline and fill stay registered.
  const [weights] = useState(() => LETTERS.map(randomWeight));

  const ctaRef = useMagnetic();
  const copy = COPY[mode] ?? COPY.work;
  // Work mode scrolls to the masonry; lab mode scrolls to the room that now
  // sits right under this hero. Both are anchors on this page, so the CTA
  // smooth-scrolls rather than navigating — the router leaves bare hashes
  // alone, and instant jumps are exactly what "seamless" is not.
  const ctaHref = mode === 'lab' ? '#reveries' : '#work';
  const onCta = (e) => {
    const el = document.querySelector(ctaHref);
    if (!el) return; // not on this page — let the browser do what it does
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: none)').matches;

  // Pre-state: the wordmark holds POSITION and starts as unreadable glyphs.
  // (This replaced a per-letter positional scatter — the reveal is now a decode,
  // so nothing here may touch x/y/rotation.)
  useLayoutEffect(() => {
    const letters = lettersRef.current.filter(Boolean);
    const ghosts = ghostRef.current.filter(Boolean);
    const sub = subRef.current;

    if (reduced) {
      if (sub) gsap.set(sub, { opacity: 1, y: 0 });
      readyRef.current = true;
      return;
    }

    // Only the ghost is faded in by the reveal. The fill's opacity is CSS's
    // (it follows the letter's own --g), so GSAP never writes it.
    gsap.set(ghosts, { opacity: 0 });
    letters.forEach((el) => (el.textContent = randomGlyph()));
    ghosts.forEach((el) => (el.textContent = randomGlyph()));
    if (sub) gsap.set(sub, { opacity: 0, y: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal: letters flicker up in place and decode, "aaa" resolving last.
  useEffect(() => {
    if (reduced || !play || playedRef.current) return undefined;
    playedRef.current = true;

    const letters = lettersRef.current.filter(Boolean);
    const ghosts = ghostRef.current.filter(Boolean);
    const sub = subRef.current;
    const disp = document.getElementById('hero-disp');
    const turb = document.getElementById('hero-turb');

    // Resolve order: body in random order, then the trailing "aaa" one by one.
    // The scatter is gone but this rhythm is the wordmark's signature.
    const n = letters.length;
    const body = gsap.utils.shuffle([...Array(Math.max(0, n - TAIL)).keys()]);
    const tail = Array.from({ length: Math.min(TAIL, n) }, (_, i) => n - Math.min(TAIL, n) + i);
    const order = [...body, ...tail];

    const tl = gsap.timeline();
    // Opacity only — no transform, or we're back to a scatter. Once every
    // outline is up the inline value is cleared so the stylesheet owns it again.
    tl.to(ghosts, {
      opacity: 1,
      duration: 0.16,
      ease: 'none',
      stagger: { each: 0.03, from: 'random' },
      onComplete: () => gsap.set(ghosts, { clearProps: 'opacity' }),
    });
    if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 0.4, ease: 'none' }, '-=0.05');

    // One displacement pulse through the decode, settling to rest. Reuses the
    // filter that is already attached to .hero__word.
    let pulse;
    if (disp && turb) {
      gsap.set(turb, { attr: { baseFrequency: 0.009 } });
      pulse = gsap.fromTo(
        disp,
        { attr: { scale: 7 } },
        {
          attr: { scale: 0 },
          duration: 1.2,
          ease: 'none',
          onComplete: () => gsap.set(turb, { attr: { baseFrequency: 0.0001 } }),
        }
      );
    }

    const cancelBase = scrambleLetters(letters, WORDMARK, { duration: 1050, order });
    // The ghost runs its own slower pass on a different order, so mid-decode the
    // two layers disagree — that mismatch is what reads as a glitch.
    const cancelGhost = scrambleLetters(ghosts, WORDMARK, {
      duration: 1320,
      rollEvery: 64,
      order: gsap.utils.shuffle([...order]),
    });

    const settled = setTimeout(() => {
      readyRef.current = true;
    }, 1400);

    return () => {
      tl.kill();
      pulse?.kill();
      cancelBase();
      cancelGhost();
      clearTimeout(settled);
    };
  }, [play, reduced]);

  // Hover: the reveal is LOCAL. Every letter gets its own `--g` from its own
  // distance to the cursor; Hero.css turns that into the fill's opacity and
  // the letter's travel along the weight axis, so a ~150px pocket of the
  // wordmark fills in and re-weights while the rest stays an outline. Nothing
  // global is driven from here — in particular the SVG warp is left alone,
  // since a whole-word warp would contradict the locality.
  useEffect(() => {
    const word = wordRef.current;
    if (!word || touch || reduced) return undefined;

    let raf = 0;
    let pending = null;
    let centres = [];
    let measuredReady = false;

    // Letter centres, cached RELATIVE TO THE WORD. Measuring 11 rects per frame
    // would force a synchronous layout on every mousemove; this way each frame
    // costs one rect read for the word itself.
    const measure = () => {
      const wr = word.getBoundingClientRect();
      if (!wr.width) return;
      centres = lettersRef.current.map((el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - wr.left, y: r.top + r.height / 2 - wr.top };
      });
      measuredReady = readyRef.current;
    };

    const clear = () => {
      lettersRef.current.forEach((el) => el && el.style.setProperty('--g', '0'));
      ghostRef.current.forEach((el) => el && el.style.setProperty('--g', '0'));
    };

    const apply = () => {
      raf = 0;
      const e = pending;
      pending = null;
      if (!e) return;

      const wr = word.getBoundingClientRect();
      if (!wr.width) return;
      // Glyphs are not the same width as the real letters, so centres measured
      // mid-decode are wrong — re-measure once the word has resolved.
      if (!centres.length || (!measuredReady && readyRef.current)) measure();

      const mx = e.clientX - wr.left;
      const my = e.clientY - wr.top;

      for (let i = 0; i < centres.length; i++) {
        const c = centres[i];
        const base = lettersRef.current[i];
        if (!c || !base) continue;
        const d = Math.hypot(mx - c.x, my - c.y);
        const g = d >= RADIUS ? 0 : 1 - d / RADIUS;

        base.style.setProperty('--g', g.toFixed(3));
        const gh = ghostRef.current[i];
        if (gh) gh.style.setProperty('--g', g.toFixed(3));
      }
    };

    const onMove = (e) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      pending = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clear();
    };

    measure();
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', measure);
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, [reduced, touch]);

  return (
    <header id="top" className="hero" data-screen-label="Hero">
      {/* Background media */}
      {mode === 'work' ? (
        <video
          className="hero__media hero__media--video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={HERO_POSTER}
          aria-hidden="true"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
      ) : (
        <img
          className="hero__media hero__media--art"
          src={LAB_IMG}
          alt="Ornamental symmetry study — pencil on handmade paper"
          loading="eager"
          decoding="async"
        />
      )}
      <div className="hero__veil" />

      {/* SVG filter powering the glassy distortion on the wordmark */}
      <svg className="hero__defs" aria-hidden="true" width="0" height="0">
        <defs>
          <filter
            id="hero-glass"
            x="-20%"
            y="-45%"
            width="140%"
            height="190%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              id="hero-turb"
              type="fractalNoise"
              baseFrequency="0.0001"
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              id="hero-disp"
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Top eyebrow row */}
      <div className="hero__top">
        <p className="eyebrow">{copy.eyebrow}</p>
        <LocationMap />
      </div>

      {/* Wordmark — decodes in place as an outline; the fill appears only in
          the cursor's pocket. aria-label pins the accessible name: the letters
          hold random glyphs for ~1s during the decode, so without it a screen
          reader announces the heading as garbage. */}
      <h1 className="hero__title" aria-label={WORDMARK}>
        <span ref={wordRef} className="hero__word" data-cursor>
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              ref={(el) => (lettersRef.current[i] = el)}
              className="hero__letter"
              style={{ '--w0': weights[i], '--w1': oppositeWeight(weights[i]) }}
            >
              {ch}
            </span>
          ))}
          {/* Stroke-only registration layer. aria-hidden: it sits inside the
              <h1>, so without it the heading is announced twice. */}
          <span className="hero__ghost" aria-hidden="true">
            {LETTERS.map((ch, i) => (
              <span
                key={i}
                ref={(el) => (ghostRef.current[i] = el)}
                className="hero__letter"
                style={{ '--w0': weights[i], '--w1': oppositeWeight(weights[i]) }}
              >
                {ch}
              </span>
            ))}
          </span>
        </span>
      </h1>

      {/* Subhead + CTA */}
      <div className="hero__foot">
        <p ref={subRef} className="hero__sub">{copy.sub}</p>
        <a ref={ctaRef} href={ctaHref} onClick={onCta} className="hero__cta" data-magnetic data-cursor>
          <span>{copy.cta}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 4v16m0 0l-6-6m6 6l6-6" />
          </svg>
        </a>
      </div>

      <div className="hero__scroll">Scroll</div>
    </header>
  );
}
