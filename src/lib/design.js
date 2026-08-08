/**
 * Live design settings, editable from the /admin Design tab (writes
 * `src/data/design.json`; Vite HMR reloads the page on change).
 *
 * Colour tokens are pushed onto :root as CSS variables so the whole stylesheet
 * follows them; the rest are read directly by the components that use them.
 * Defaults here are the source of truth if a key is missing from the JSON.
 */
import saved from '../data/design.json';

const DEFAULTS = {
  accent: '#d98b2b',
  bg: '#0a0a0a',
  columns: 4,
  marqueeSpeed: 42,
  fuiOpacity: 0.085,
  fuiGlow: true,
  introLoader: true,
  landingGate: true,
  cardHoverZoom: true,
};

export const DESIGN = { ...DEFAULTS, ...saved };

/** Push the themeable values onto :root. Called once at app start. */
export function applyDesign() {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;
  r.setProperty('--accent', DESIGN.accent);
  r.setProperty('--bg', DESIGN.bg);
  r.setProperty('--fui-opacity', String(DESIGN.fuiOpacity));
  r.setProperty('--card-zoom', DESIGN.cardHoverZoom ? '1.055' : '1.012');
}
