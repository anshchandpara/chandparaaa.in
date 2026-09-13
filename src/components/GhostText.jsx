import { useEffect, useRef, useState } from 'react';
import { randomWeight, oppositeWeight } from '../lib/weights';
import './GhostText.css';

/**
 * The hero wordmark's treatment (Hero.jsx) for any line of type: at rest the
 * line is its OUTLINE, each letter at its own random cut on the weight axis;
 * inside the cursor's pocket a letter fills in and travels to the opposite
 * cut, by its own distance to the cursor. Weights are drawn once per mount.
 * Nothing here is word-wide — the reveal is local, and the line reflows as
 * letters re-weight, exactly as the hero does.
 *
 * Touch and reduced motion have no pocket, so they get the fill outright
 * (GhostText.css). The hero keeps its own copy of this loop because it also
 * runs the load decode and the glass pulse; this is the treatment alone.
 */
export default function GhostText({ text, className = '' }) {
  const chars = text.split('');
  const [weights] = useState(() => chars.map(randomWeight));
  const wordRef = useRef(null);
  const lettersRef = useRef([]);
  const ghostRef = useRef([]);

  useEffect(() => {
    const word = wordRef.current;
    if (!word) return undefined;
    const mq = (q) => window.matchMedia && window.matchMedia(q).matches;
    if (mq('(hover: none)') || mq('(prefers-reduced-motion: reduce)')) return undefined;

    // The pocket scales with the type: ~1.45× the font size, as the hero's
    // 150px is to its wordmark, never tighter than 110px.
    const radius = Math.max(110, parseFloat(getComputedStyle(word).fontSize) * 1.45);
    let raf = 0;
    let pending = null;
    let centres = [];

    // Letter centres cached RELATIVE TO THE WORD — one rect per frame, not one
    // per letter. Re-measured on resize; the word reflows mid-hover, which the
    // hero also accepts.
    const measure = () => {
      const wr = word.getBoundingClientRect();
      if (!wr.width) return;
      centres = lettersRef.current.map((el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - wr.left, y: r.top + r.height / 2 - wr.top };
      });
    };
    const setAll = (g) => {
      lettersRef.current.forEach((el) => el && el.style.setProperty('--g', g));
      ghostRef.current.forEach((el) => el && el.style.setProperty('--g', g));
    };
    const apply = () => {
      raf = 0;
      const e = pending;
      pending = null;
      if (!e) return;
      const wr = word.getBoundingClientRect();
      if (!wr.width) return;
      if (!centres.length) measure();
      const mx = e.clientX - wr.left;
      const my = e.clientY - wr.top;
      for (let i = 0; i < centres.length; i++) {
        const c = centres[i];
        if (!c) continue;
        const d = Math.hypot(mx - c.x, my - c.y);
        const g = (d >= radius ? 0 : 1 - d / radius).toFixed(3);
        lettersRef.current[i]?.style.setProperty('--g', g);
        ghostRef.current[i]?.style.setProperty('--g', g);
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
      setAll('0');
    };

    measure();
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', measure);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', measure);
    return () => {
      fonts?.removeEventListener('loadingdone', measure);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', measure);
      if (raf) cancelAnimationFrame(raf);
      setAll('0');
    };
  }, []);

  const letter = (ch, i, refs) => (
    <span
      key={i}
      ref={(el) => (refs.current[i] = el)}
      className="gt__letter"
      style={{ '--w0': weights[i], '--w1': oppositeWeight(weights[i]) }}
    >
      {ch === ' ' ? ' ' : ch}
    </span>
  );

  return (
    <span ref={wordRef} className={`gt ${className}`.trim()} aria-label={text}>
      <span className="gt__word" aria-hidden="true">
        {chars.map((ch, i) => letter(ch, i, lettersRef))}
      </span>
      <span className="gt__ghost" aria-hidden="true">
        {chars.map((ch, i) => letter(ch, i, ghostRef))}
      </span>
    </span>
  );
}
