import { useEffect, useRef, useState } from 'react';
import { randomWeight, oppositeWeight } from '../lib/weights';

const NAME = 'Ansh Chandpara';
const CHARS = NAME.split('');

/**
 * The nav wordmark. One span per letter so each can sit at its own random cut
 * on the display face's weight axis (see lib/weights.js); the cuts are drawn
 * once per mount, so the line is stable while a page is open and re-set on
 * the next. Hovering the link flips every letter to its opposite cut
 * (Nav.css) — thin goes heavy, heavy goes thin.
 *
 * Each letter is pinned to a fixed cell — the wider of its two cuts — so the
 * morph happens IN PLACE. Left to reflow, a heavier glyph pushes every letter
 * after it sideways (measured: up to 3.6px at 16px) and the whole name
 * shivers for the length of the transition; pinned, nothing moves but the
 * strokes. Measured after the kit's face has loaded, and again if fonts
 * finish loading later, since the fallback face has different advances.
 */
export default function Brand() {
  const [weights] = useState(() => CHARS.map(randomWeight));
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const cells = Array.from(el.querySelectorAll('.nav__brand-letter'));
    let alive = true;

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

    pin();
    const fonts = document.fonts;
    if (fonts) {
      fonts.load('16px "obviously-variable"').then(pin, () => {});
      fonts.addEventListener('loadingdone', pin);
    }
    return () => {
      alive = false;
      fonts?.removeEventListener('loadingdone', pin);
    };
  }, []);

  return (
    <a ref={ref} href="./" data-cursor className="nav__brand" aria-label={NAME}>
      {CHARS.map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : (
          <span
            key={i}
            className="nav__brand-letter"
            style={{ '--w0': weights[i], '--w1': oppositeWeight(weights[i]) }}
          >
            {ch}
          </span>
        )
      )}
    </a>
  );
}
