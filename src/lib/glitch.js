/**
 * Typewriter/terminal glitch text.
 *
 * `scramble()` runs a label through special characters and resolves it roughly
 * left-to-right, like a decoding readout. Raw rAF rather than GSAP, matching
 * how Loader.jsx and Work.jsx drive their own frame loops.
 *
 * Glyphs are re-rolled on a ~45ms cadence, NOT every frame — at 60fps the
 * characters churn so fast they blur into noise and read as a flicker rather
 * than as type.
 */

const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&@';

/** One random special character. */
export const randomGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

/**
 * Scramble `el`'s text into `finalText`. Returns a cancel function that snaps
 * the element to the final text immediately — call it on mouseleave and on
 * unmount, or a fast in/out leaves the button reading "#$%@".
 */
export function scramble(el, finalText, { duration = 520, rollEvery = 45 } = {}) {
  if (!el) return () => {};

  const chars = [...finalText];
  const n = Math.max(1, chars.length - 1);

  // Each character settles a little after the one before it, with jitter, so
  // the word resolves left-to-right instead of all at once.
  const settleAt = chars.map(
    (_, i) => duration * (0.25 + 0.6 * (i / n)) + Math.random() * duration * 0.15
  );

  const shown = chars.map(randomGlyph);
  const start = performance.now();
  let lastRoll = 0;
  let raf = 0;

  const finish = () => {
    el.textContent = finalText;
  };

  const tick = (now) => {
    const t = now - start;
    const roll = t - lastRoll >= rollEvery;
    if (roll) lastRoll = t;

    let done = true;
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      if (t >= settleAt[i] || chars[i] === ' ') {
        out += chars[i];
      } else {
        if (roll) shown[i] = randomGlyph();
        out += shown[i];
        done = false;
      }
    }
    el.textContent = out;

    if (done) return finish();
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    finish();
  };
}

/**
 * Per-element variant. `scramble()` writes textContent on ONE node, which would
 * flatten a wordmark built from per-letter spans — the hero needs those spans
 * intact to transform letters individually, so this writes one character per
 * element instead.
 *
 * `order` is a list of element indices giving the resolve sequence (default
 * left-to-right). The hero passes an order that settles the trailing "aaa"
 * last, preserving the wordmark's rhythm now that the scatter is gone.
 *
 * Returns a cancel function that snaps every element to its final character.
 */
export function scrambleLetters(els, finalChars, { duration = 900, rollEvery = 45, order } = {}) {
  const nodes = (els || []).filter(Boolean);
  if (!nodes.length) return () => {};

  const chars = [...finalChars];
  const seq = order && order.length === nodes.length ? order : nodes.map((_, i) => i);
  const last = Math.max(1, seq.length - 1);

  // Position in `seq` decides when a letter settles, so callers control rhythm
  // without this needing to know anything about the word.
  const settleAt = new Array(nodes.length);
  seq.forEach((nodeIndex, place) => {
    settleAt[nodeIndex] = duration * (0.2 + 0.72 * (place / last)) + Math.random() * duration * 0.08;
  });

  const shown = nodes.map(randomGlyph);
  const start = performance.now();
  let lastRoll = 0;
  let raf = 0;

  const finish = () => {
    nodes.forEach((el, i) => {
      el.textContent = chars[i] ?? '';
    });
  };

  const tick = (now) => {
    const t = now - start;
    const roll = t - lastRoll >= rollEvery;
    if (roll) lastRoll = t;

    let done = true;
    for (let i = 0; i < nodes.length; i++) {
      const ch = chars[i];
      if (t >= settleAt[i] || ch === ' ') {
        if (nodes[i].textContent !== ch) nodes[i].textContent = ch;
      } else {
        if (roll) {
          shown[i] = randomGlyph();
          nodes[i].textContent = shown[i];
        }
        done = false;
      }
    }

    if (done) return finish();
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    finish();
  };
}
