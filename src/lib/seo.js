import { getProject } from './projectData';

/**
 * Everything a crawler or a share card should know about a route, in one
 * place. Pure: takes the route, returns the meta. `hooks/useDocumentMeta`
 * writes it into <head>; `tools/build-sitemap.mjs`
 * lists the same routes (in Node, from projects.json directly).
 *
 * Why this exists: the site is a query-routed SPA on GitHub Pages. Every URL
 * serves the same index.html, so without this a project page carries the
 * home page's title — measured 2026-09-12, the HTML served for `?p=lootere`
 * contained zero mentions of Lootere. Google renders JS and will read what
 * this sets; crawlers that do not (most social previews) get the site-level
 * defaults from index.html. Per-page share cards need prerendered pages —
 * a URL change, deliberately not done here.
 */
export const SITE = {
  origin: 'https://chandparaaa.in',
  name: 'Ansh Chandpara',
  title: 'Ansh Chandpara — Artist · CG Generalist · Creative Director',
  description:
    'Ansh Chandpara — Artist, CG Generalist & Creative Director. Selected work across title design, film, music videos, and brand storytelling.',
  image: 'https://chandparaaa.in/og.jpg',
  jobTitle: 'Artist, CG Generalist & Creative Director',
  locale: 'en_IN',
};

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE.origin}/#ansh`,
  name: SITE.name,
  jobTitle: SITE.jobTitle,
  url: SITE.origin,
  image: SITE.image,
  // sameAs deliberately absent: the About page's social links are placeholders
  // (href="#") and the mailto there is flagged stale in memory/lessons.md.
  // Structured data must not assert what the site cannot back.
};

/** Trim prose to a description length, on a word boundary, no dangling dash. */
export function summarise(text, max = 155) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 80)).replace(/[\s—–-]+$/, '')}…`;
}

/** Make a media URL absolute — dev serves media from `/`, prod from R2. */
const absolute = (url) => {
  if (!url) return null;
  if (/^https?:/.test(url)) return url;
  return `${SITE.origin}/${url.replace(/^\.?\//, '')}`;
};

/** Route → meta. `slug` wins over `page`; neither = home. */
export function metaForRoute({ slug, page } = {}) {
  if (slug) return projectMeta(slug);
  if (page === 'about') {
    return {
      title: `About · ${SITE.name}`,
      description: `${SITE.name} is a ${SITE.jobTitle.toLowerCase()} working direct with clients and studios on title sequences, films, music videos and brand work.`,
      canonical: `${SITE.origin}/?page=about`,
      image: SITE.image,
      type: 'profile',
      jsonLd: { '@context': 'https://schema.org', ...PERSON, mainEntityOfPage: `${SITE.origin}/?page=about` },
    };
  }
  return {
    title: SITE.title,
    description: SITE.description,
    canonical: `${SITE.origin}/`,
    image: SITE.image,
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE.origin}/#site`, url: SITE.origin, name: SITE.name, description: SITE.description, author: { '@id': PERSON['@id'] } },
        PERSON,
      ],
    },
  };
}

function projectMeta(slug) {
  const { item, heroImg } = getProject(slug);
  if (!item || item.slug !== slug) return metaForRoute(); // unknown slug → home meta, no false claims
  const category = item.category || 'Project';
  const parts = [item.title, category].filter(Boolean);
  const title = `${parts.join(' — ')} · ${SITE.name}`;
  const fallback = [item.title, category, item.client ? `for ${item.client}` : null, item.year ? `(${item.year})` : null]
    .filter(Boolean).join(' ') + `. By ${SITE.name}.`;
  const description = summarise(item.desc) || fallback;
  const image = absolute(heroImg) || SITE.image;
  const url = `${SITE.origin}/?p=${encodeURIComponent(slug)}`;

  const work = {
    '@context': 'https://schema.org',
    '@type': item.video ? 'VideoObject' : 'CreativeWork',
    name: item.title,
    description,
    url,
    image,
    creator: { '@id': PERSON['@id'] },
    ...(item.year ? { dateCreated: String(item.year) } : {}),
    ...(category ? { genre: category } : {}),
    ...(item.client ? { sourceOrganization: { '@type': 'Organization', name: item.client } } : {}),
    // VideoObject wants thumbnailUrl + uploadDate. The year is all that is
    // known, and a bare year is valid ISO 8601 — never invent a month and day.
    ...(item.video ? { thumbnailUrl: image, ...(item.year ? { uploadDate: String(item.year) } : {}), embedUrl: `https://player.vimeo.com/video/${item.video}` } : {}),
  };
  return { title, description, canonical: url, image, type: item.video ? 'video.other' : 'article', jsonLd: work };
}
