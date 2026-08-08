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
