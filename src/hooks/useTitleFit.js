import { useLayoutEffect } from 'react';

/**
 * Size a display title to its own length so it fits its column.
 *
 * ### Why this exists
 *
 * `.pd__title` is `overflow: hidden` — the clip mask the GSAP rise animates out
 * of. That mask cannot be vertical-only (CSS forces both axes non-visible once
 * one is), so it silently crops HORIZONTALLY too. A single word wider than the
 * column therefore gets guillotined with no warning: measured 2026-09-10,
 * `MANORATHANGAL` rendered as `MANORAT` at 129.6px in a 569px column — 501px of
 * the word simply gone. Multi-word titles wrap and escape it; single long words
 * cannot.
 *
 * One `clamp()` cannot fix that, because the thing that overflows is not the
 * viewport, it is the STRING. Titles here run 4 to 26 characters, and character
 * count does not predict width either — `Reel Edit 2026` and `Murder Mubarak`
 * are both 14 characters and differ 28% in rendered width. So the size has to
 * come from measuring the text as laid out, which is what this does.
 *
 * ### Method
 *
 * Binary search the largest size that satisfies BOTH conditions: within the line
 * budget, and no horizontal overflow. Line count alone is not enough — an
 * unbreakable word reports one line while running past the edge, which is the
 * exact bug above.
 *
 * Measurement is on the real element, not a canvas estimate, so wrapping,
 * tracking and the actual loaded face are all accounted for.
 *
 * ### Ordering (this matters)
 *
 * The rise is `gsap.set(el, { yPercent: 115 })` and `yPercent` resolves against
 * the element's own height — which depends on the font size this sets. So the
 * fit MUST land before the mask is set, or the title rises from the wrong
 * offset. Callers must declare this hook BEFORE the clip-rise layout effect;
 * React runs layout effects in declaration order.
 *
 * `font-stretch` is deliberately left alone: Space Grotesk has no width axis.
 * When the display face gains one (Obviously, Archivo), narrowing before
 * shrinking goes here — that is how a title designer fits a lockup.
 */

const LINE_HEIGHT = 0.9; // must match .pd__title's line-height
const DEFAULTS = { min: 56, max: 136, lines: 2 };

/**
 * Offscreen twin of the title, used to measure text at its natural width.
 *
 * Necessary because you CANNOT read overflow off the real element: the span is
 * shrink-to-fit inside an `overflow: hidden` box, so its used width is capped at
 * the container and `getBoundingClientRect()` reports the cap, not the text.
 * Measured 2026-09-10: box 1123px, reported span width 1123px, actual ink
 * 1149px. An overflow test built on that comparison can never fire — which is
 * how the crop survived the first version of this hook.
 *
 * `white-space: pre` is the point: it stops wrapping so the element reports true
 * max-content width. Every property that changes advance width is copied over.
 */
function makeGauge(box) {
  const cs = getComputedStyle(box);
  const g = document.createElement('span');
  g.setAttribute('aria-hidden', 'true');
  g.style.cssText =
    'position:absolute;left:-99999px;top:0;white-space:pre;visibility:hidden;pointer-events:none';
  g.style.fontFamily = cs.fontFamily;
  g.style.fontWeight = cs.fontWeight;
  g.style.fontStyle = cs.fontStyle;
  g.style.fontStretch = cs.fontStretch;
  g.style.textTransform = cs.textTransform;
  g.style.letterSpacing = cs.letterSpacing; // em-based, so it scales with size
  document.body.appendChild(g);
  return g;
}

/**
 * Width of the widest single word at `px`. Words are what cannot break, so this
 * is the real constraint — a multi-word title wraps and is fine, a long single
 * word (MANORATHANGAL) has nowhere to go and gets guillotined by the mask.
 */
function widestWord(gauge, text, px) {
  gauge.style.fontSize = `${px}px`;
  let widest = 0;
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    gauge.textContent = word;
    widest = Math.max(widest, gauge.getBoundingClientRect().width);
  }
  return widest;
}

/** Within the line budget AND no word wider than the column. Both, or no fit. */
function fits(box, span, gauge, text, px, lines) {
  box.style.fontSize = `${px}px`;
  const lineCount = Math.max(1, Math.round(span.getBoundingClientRect().height / (px * LINE_HEIGHT)));
  return lineCount <= lines && widestWord(gauge, text, px) <= box.clientWidth;
}

export function fitTitle(box, opts = {}) {
  const span = box && box.firstElementChild;
  if (!box || !span) return;
  const { min, max, lines } = { ...DEFAULTS, ...opts };

  // Measure with any transform cleared: a mid-rise element reports a displaced
  // box and every reading off it is wrong.
  const prevTransform = span.style.transform;
  span.style.transform = 'none';

  const text = span.textContent || '';
  const gauge = makeGauge(box);

  let best = min;
  if (fits(box, span, gauge, text, max, lines)) {
    best = max;
  } else {
    let lo = min;
    let hi = max;
    for (let i = 0; i < 14; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(box, span, gauge, text, mid, lines)) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    // Floor, never round: the search only ever records a size it PROVED fits,
    // so rounding up steps back over that boundary and re-crops the title.
    best = Math.floor(best);
  }

  gauge.remove();
  box.style.fontSize = '';
  box.style.setProperty('--title-size', `${best}px`);
  span.style.transform = prevTransform;
  return best;
}

/**
 * @param {object} ref   ref to the title BOX (.pd__title), whose first child
 *                       holds the text
 * @param {Array}  deps  re-fit when these change (the slug)
 */
export function useTitleFit(ref, deps = [], opts = {}) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return undefined;

    const run = () => fitTitle(box, opts);
    run();

    // A web font changes every measurement, and it usually arrives after mount.
    // Without this the title is sized against the fallback's metrics.
    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) run();
      });
    }

    let frame = 0;
    const onResize = () => {
      cancelActive();
      frame = requestAnimationFrame(run);
    };
    function cancelActive() {
      if (frame) cancelAnimationFrame(frame);
    }
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      cancelActive();
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
