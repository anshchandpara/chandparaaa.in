import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { useMagnetic } from '../hooks/useMagnetic';
import LocationMap from './LocationMap';
// Hero background loop — muted, self-hosted in /public. Shared with the Landing
// gate (lib/heroVideo.js) so both play the same cached file.
import { HERO_VIDEO, HERO_POSTER } from '../lib/heroVideo';
// Lab-mode cover — Ansh's own ornamental drawing (replaces a stock photo).
import LAB_IMG from '../media/lab/lab-cover.jpg';
import './Hero.css';

const WORDMARK = 'Chandparaaa';
const LETTERS = WORDMARK.split('');
const TAIL = 3; // the trailing "aaa" — these settle in last

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
  const subRef = useRef(null);
  const wordRef = useRef(null);
  const playedRef = useRef(false);
  const readyRef = useRef(false); // true once the scatter intro has settled
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

  // Pre-state: scatter the letters into a jumble (or rest, if reduced motion).
  useLayoutEffect(() => {
    const letters = lettersRef.current.filter(Boolean);
    const sub = subRef.current;

    if (reduced) {
      gsap.set(letters, { x: 0, y: 0, rotation: 0, opacity: 1 });
      if (sub) gsap.set(sub, { opacity: 1, y: 0 });
      readyRef.current = true;
      return;
    }

    const r = gsap.utils.random;
    letters.forEach((el) =>
      gsap.set(el, {
        x: r(-280, 280),
        y: r(-180, 180),
        rotation: r(-55, 55),
        opacity: 0,
      })
    );
    if (sub) gsap.set(sub, { opacity: 0, y: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play once, when the loader is done: letters arrange into order, "aaa" last.
  useEffect(() => {
    if (reduced || !play || playedRef.current) return undefined;
    playedRef.current = true;

    const letters = lettersRef.current.filter(Boolean);
    const main = letters.slice(0, letters.length - TAIL);
    const tail = letters.slice(-TAIL);
    const sub = subRef.current;

    const tl = gsap.timeline();
    // Body of the name snaps into place from random scatter, in random order.
    tl.to(main, {
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 1,
      duration: 0.7,
      ease: 'expo.out',
      stagger: { each: 0.05, from: 'random' },
    });
    // The trailing "aaa" settles in last, one after another.
    tl.to(
      tail,
      {
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
        duration: 0.85,
        ease: 'expo.out',
        stagger: 0.14,
      },
      '-=0.18'
    );
    if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 0.4, ease: 'none' }, '-=0.35');

    // Gravity may engage once the letters have settled.
    tl.eventCallback('onComplete', () => {
      readyRef.current = true;
    });
    const safety = setTimeout(() => {
      readyRef.current = true;
    }, 2200);

    return () => {
      tl.kill();
      clearTimeout(safety);
    };
  }, [play, reduced]);

  // Hover: invert the colour, ramp up the glassy distortion, and let a subtle
  // gravity pull the letters down.
  useEffect(() => {
    const word = wordRef.current;
    if (!word || touch) return undefined;

    const disp = document.getElementById('hero-disp');
    const turb = document.getElementById('hero-turb');
    let wobble;

    // Per-letter downward sag — a gentle catenary (middle droops most) so the
    // whole word feels weighed down rather than uniformly shifted.
    const gravity = (settle) => {
      const letters = lettersRef.current.filter(Boolean);
      const n = letters.length;
      gsap.to(letters, {
        y: (i) => (settle ? 6 + Math.sin((i / (n - 1)) * Math.PI) * 12 : 0),
        rotation: (i) => (settle ? (i % 2 ? 1.5 : -1.5) : 0),
        duration: settle ? 0.55 : 0.5,
        ease: settle ? 'sine.in' : 'sine.out',
        stagger: { each: 0.015, from: 'edges' },
      });
    };

    const enter = () => {
      word.classList.add('is-hot'); // CSS inverts the colour (mix-blend-mode)
      if (reduced || !disp || !turb) return;
      gsap.killTweensOf(disp);
      gsap.to(disp, { attr: { scale: 3.3 }, duration: 0.6, ease: 'none' }); // +50% amplitude
      gsap.set(turb, { attr: { baseFrequency: 0.006 } });
      wobble?.kill();
      wobble = gsap.to(turb, {
        attr: { baseFrequency: 0.011 },
        duration: 2.2,
        ease: 'none',
        repeat: -1,
        yoyo: true,
      });
      if (readyRef.current) gravity(true);
    };
    const leave = () => {
      word.classList.remove('is-hot');
      if (reduced || !disp || !turb) return;
      wobble?.kill();
      wobble = null;
      gsap.killTweensOf(disp);
      gsap.to(disp, {
        attr: { scale: 0 },
        duration: 0.4,
        ease: 'none',
        onComplete: () => gsap.set(turb, { attr: { baseFrequency: 0.0001 } }),
      });
      if (readyRef.current) gravity(false);
    };

    word.addEventListener('mouseenter', enter);
    word.addEventListener('mouseleave', leave);
    return () => {
      word.removeEventListener('mouseenter', enter);
      word.removeEventListener('mouseleave', leave);
      wobble?.kill();
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

      {/* Wordmark — letters scatter in and settle into order */}
      <h1 className="hero__title">
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
