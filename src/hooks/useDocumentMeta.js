import { useEffect } from 'react';

/**
 * Write a route's meta into <head>: title, description, canonical, the Open
 * Graph / Twitter set, and one JSON-LD block. Idempotent — every tag is found
 * or created once and then updated, so route changes never accumulate
 * duplicates. The static defaults in index.html stay in place for crawlers
 * that never run this.
 */
function upsert(selector, create, apply) {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  apply(el);
  return el;
}
const meta = (attr, key, content) => {
  if (content == null) return;
  upsert(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, (m) => m.setAttribute('content', content));
};

export function useDocumentMeta(m) {
  useEffect(() => {
    if (!m) return;
    document.title = m.title;
    meta('name', 'description', m.description);
    upsert('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, (l) => { l.href = m.canonical; });
    meta('property', 'og:title', m.title);
    meta('property', 'og:description', m.description);
    meta('property', 'og:url', m.canonical);
    meta('property', 'og:image', m.image);
    meta('property', 'og:type', m.type || 'website');
    meta('name', 'twitter:title', m.title);
    meta('name', 'twitter:description', m.description);
    meta('name', 'twitter:image', m.image);
    upsert('script#ld-json', () => { const s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'ld-json'; return s; },
      (s) => { s.textContent = m.jsonLd ? JSON.stringify(m.jsonLd) : ''; });
  }, [m?.canonical, m?.title, m?.description, m?.image, m?.type]);
}
