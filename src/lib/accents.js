/**
 * Per-project accent colors. Used ONLY for thumbnail / shader tint backgrounds
 * and never for UI chrome. Covers both featured work and the wider archive.
 */
export const ACCENTS = {
  'the-railway-men': '#c08a4a',
  lootere: '#b5642e',
  hunter: '#4f7a48',
  mindscapes: '#545d86',
  equals: '#9a4f4f',
  'raat-khatam': '#9a7a55',
  'union-day-yas-mall': '#c8903a',
  'savi-bb': '#5a8a76',
  isbl: '#a06a3a',
  ekam: '#6a6a9a',
  'icc-womens-t20-2024': '#b5642e',
  'murder-mubarak': '#9a6a3a',
  tivvra: '#7a7a8a',
  'uv-automotive-f77': '#8a5aa0',
  'spring-health': '#5a8a6a',
  asur: '#7a4a4a',
  'britannia-winkin-cow': '#b08a4a',
  'lakk-nu-hila': '#a05a7a',
};

export const DEFAULT_ACCENT = '#b08b55';

export const getAccent = (slug) => ACCENTS[slug] || DEFAULT_ACCENT;
