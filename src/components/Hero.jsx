import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { useMagnetic } from '../hooks/useMagnetic';
import LocationMap from './LocationMap';
// Hero background loop — muted, self-hosted in /public. Shared with the Landing
// gate (lib/heroVideo.js) so both play the same cached file.
import { HERO_VIDEO, HERO_POSTER } from '../lib/heroVideo';
// Lab-mode cover — Ansh's own ornamental drawing (replaces a stock photo).
import LAB_IMG from '../media/lab/lab-cover.jpg';
import { scrambleLetters, randomGlyph } from '../lib/glitch';
import './Hero.css';

const WORDMARK = 'Chandparaaa';
const LETTERS = WORDMARK.split('');
const TAIL = 3; // the trailing "aaa" — these resolve last

// The glitch is LOCAL: each letter's intensity comes from its own distance to
// the cursor, falling to 0 at this radius. Only letters inside it react.
const RADIUS = 150;
// Above this per-letter intensity the colour inverts.
const HOT_AT = 0.5;

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

  const ctaRef = useMagnetic();
  const copy = COPY[mode] ?? COPY.work;

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
      gsap.set(letters, { opacity: 1 });
      if (sub) gsap.set(sub, { opacity: 1, y: 0 });
      readyRef.current = true;
      return;
    }

    gsap.set(letters, { opacity: 0 });
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
    // Opacity only — no transform, or we're back to a scatter.
    tl.to(letters, {
      opacity: 1,
      duration: 0.16,
      ease: 'none',
      stagger: { each: 0.03, from: 'random' },
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

  // Hover: the glitch is LOCAL. Every letter gets its own `--g` from its own
  // distance to the cursor, so a ~150px pocket of the wordmark glitches and
  // inverts while the rest stays clean type. Nothing global is driven from
  // here — in particular the SVG warp is left alone, since a whole-word warp
  // would contradict the locality.
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
      lettersRef.current.forEach((el) => {
        if (!el) return;
        el.style.setProperty('--g', '0');
        el.classList.remove('is-hot');
      });
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
        const isHot = g > HOT_AT;
        if (base.classList.contains('is-hot') !== isHot) base.classList.toggle('is-hot', isHot);

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

  // Live character churn while the cursor is close: a couple of letters drop to
  // a glyph and snap back. Only after the decode has resolved, or it fights it.
  useEffect(() => {
    if (reduced || touch) return undefined;
    const timers = new Set();

    const id = setInterval(() => {
      if (!readyRef.current || !wordRef.current) return;

      // Only letters actually under the cursor's pocket are eligible — each
      // one's own `--g`, not a word-wide intensity.
      const near = [];
      lettersRef.current.forEach((el, i) => {
        if (!el) return;
        const g = parseFloat(el.style.getPropertyValue('--g')) || 0;
        if (g > 0.35) near.push({ i, g });
      });
      if (!near.length) return;

      const letters = lettersRef.current;
      const ghosts = ghostRef.current;
      const hits = 1 + ((Math.random() * 2) | 0);
      for (let k = 0; k < hits; k++) {
        const pick = near[(Math.random() * near.length) | 0];
        // Stronger intensity → likelier to actually fire.
        if (Math.random() > pick.g) continue;
        const i = pick.i;
        const el = Math.random() < 0.5 ? letters[i] : ghosts[i];
        if (!el) continue;
        el.textContent = randomGlyph();
        const t = setTimeout(() => {
          el.textContent = LETTERS[i];
          timers.delete(t);
        }, 70 + Math.random() * 90);
        timers.add(t);
      }
    }, 90);

    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
      // Never leave the wordmark misspelled.
      lettersRef.current.forEach((el, i) => el && (el.textContent = LETTERS[i]));
      ghostRef.current.forEach((el, i) => el && (el.textContent = LETTERS[i]));
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

      {/* Wordmark — decodes in place, then glitches with cursor proximity.
          aria-label pins the accessible name: the letters hold random glyphs
          for ~1s during the decode (and again briefly during hover churn), so
          without it a screen reader announces the heading as garbage. */}
      <h1 className="hero__title" aria-label={WORDMARK}>
        <span ref={wordRef} className="hero__word" data-cursor>
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              ref={(el) => (lettersRef.current[i] = el)}
              className="hero__letter"
            >
              {ch}
            </span>
          ))}
          {/* Stroke-only registration layer. aria-hidden: it sits inside the
              <h1>, so without it the heading is announced twice. */}
          <span className="hero__ghost" aria-hidden="true">
            {LETTERS.map((ch, i) => (
              <span key={i} ref={(el) => (ghostRef.current[i] = el)} className="hero__letter">
                {ch}
              </span>
            ))}
          </span>
        </span>
      </h1>

      {/* Subhead + CTA */}
      <div className="hero__foot">
        <p ref={subRef} className="hero__sub">{copy.sub}</p>
        <a ref={ctaRef} href="#work" className="hero__cta" data-magnetic data-cursor>
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
