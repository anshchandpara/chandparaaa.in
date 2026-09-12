/**
 * Per-letter weights on the display face's variable axis.
 *
 * Obviously Variable's wght axis runs 200 → 900 (the Adobe kit in index.html
 * declares `font-weight: 200 900`). A wordmark draws one random cut per
 * letter, once per mount — so no line ever sets in a single weight, and no two
 * page loads set it the same way. `oppositeWeight` mirrors a cut across the
 * axis (200 ↔ 900, 550 stays), which is the hover target: the further a letter
 * sits from the middle, the further it travels.
 */
export const WGHT_MIN = 200;
export const WGHT_MAX = 900;

export const randomWeight = () =>
  WGHT_MIN + Math.round(Math.random() * (WGHT_MAX - WGHT_MIN));

export const oppositeWeight = (w) => WGHT_MIN + WGHT_MAX - w;
