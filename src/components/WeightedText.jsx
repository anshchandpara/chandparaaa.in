import { useEffect, useRef, useState } from 'react';
import { randomWeight, oppositeWeight } from '../lib/weights';
import './WeightedText.css';

/**
 * A line of type where every letter sits at its own random cut on the display
 * face's weight axis (see lib/weights.js) and flips to the opposite cut while
 * the line — or the `hoverWithin` ancestor it names — is hovered. Drawn once
 * per mount, so the line is stable while a page is open and re-set on the next.
 *
 * Each letter is pinned to a fixed cell, the wider of its two cuts, so the
 * morph happens IN PLACE: left to reflow, a heavier glyph pushes every letter
 * after it sideways and the whole line shivers for the length of the
 * transition. Cells are measured once the kit's face has loaded, again if
 * fonts finish loading later (the fallback face has other advances), and
 * again on resize, since the cell is in px and the type may be in vw.
 *
 * Used by the nav brand and the "All work" header. The hero wordmark has its
 * own, cursor-driven version of this idea (Hero.jsx).
 */
export default function WeightedText({ text, className = '' }) {
  const chars = text.split('');
  const [weights] = useState(() => chars.map(randomWeight));
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const cells = Array.from(el.querySelectorAll('.wt__letter'));
    let alive = true;
    let raf = 0;

    const widthsAt = (hot) => {
      cells.forEach((c) => (hot ? c.style.setProperty('--wght', 'var(--w1)') : c.style.removeProperty('--wght')));
      return cells.map((c) => c.getBoundingClientRect().width);
    };
    const pin = () => {
      if (!alive) return;
      // Transitions off while measuring: flipping the weight to read the hot
      // advance would otherwise START the hover morph and then reverse it —
      // a visible wobble on load. The reflow before restoring makes the
      // rest state land without a transition too.
      cells.forEach((c) => {
        c.style.transition = 'none';
        c.style.width = ''; // measure the natural advance
      });
      const rest = widthsAt(false);
      const hot = widthsAt(true);
      widthsAt(false);
      cells.forEach((c, i) => (c.style.width = `${Math.max(rest[i], hot[i])}px`));
      el.getBoundingClientRect();
      cells.forEach((c) => (c.style.transition = ''));
    };
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        pin();
      });
    };

    pin();
    const fonts = document.fonts;
    if (fonts) {
      fonts.load(`${getComputedStyle(el).fontSize} "obviously-variable"`).then(pin, () => {});
      fonts.addEventListener('loadingdone', pin);
    }
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      alive = false;
      fonts?.removeEventListener('loadingdone', pin);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={ref} className={`wt ${className}`.trim()} aria-label={text}>
      {chars.map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : (
          <span
            key={i}
            className="wt__letter"
            aria-hidden="true"
            style={{ '--w0': weights[i], '--w1': oppositeWeight(weights[i]) }}
          >
            {ch}
          </span>
        )
      )}
    </span>
  );
}
