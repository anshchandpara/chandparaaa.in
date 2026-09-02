import data from '../data/projects.json';
import { getAccent } from './accents';
import { getImages, baseName, isVideoSrc } from './images';

/**
 * Flatten work + lab into a single ordered list of detail-page records.
 * Draft projects are excluded by default (they stay hidden until content is
 * added); pass `{ includeDrafts: true }` to resolve one for preview.
 */
export function getAllProjects({ includeDrafts = false } = {}) {
  const list = [
    ...data.work.map((p) => ({
      slug: p.slug,
      num: p.num,
      title: p.title,
      subtitle: p.subtitle || '',
      category: p.category,
      client: p.client || '—',
      year: p.year ? String(p.year) : '—',
      role: p.role || '—',
      platform: p.platform || '—',
      desc: p.desc || '',
      credits: p.credits || [],
      image: p.image || '',
      gallery: p.gallery || [],
      video: p.video || '', // Vimeo ID — plays the title sequence as the hero
      // True aspect of that film, from `npm run media:video-meta`. The hero is a
      // fixed box and the films are not one shape (1.775 vs 2.393 scope), so the
      // iframe is sized from this to COVER rather than letterbox. 16/9 fallback.
      videoAspect: Number(p.videoAspect) > 0 ? Number(p.videoAspect) : 16 / 9,
      youtube: p.youtube || '', // full YouTube URL — "Watch the film" link
      // Text breaks between gallery frames: [{ after: <n frames>, label?, text }]
      notes: (p.notes || [])
        .map((n) => ({
          after: Number.isFinite(+n.after) ? Math.max(0, +n.after) : 0,
          label: (n.label || '').trim(),
          text: (n.text || '').trim(),
        }))
        .filter((n) => n.text),
      draft: !!p.draft,
    })),
    ...data.lab.map((x) => ({
      slug: x.slug,
      num: `L·${x.code}`,
      title: x.title,
      subtitle: '',
      category: x.kind,
      client: 'Personal',
      year: x.year ? String(x.year) : '—',
      role: 'Experiment',
      platform: '—',
      desc: x.desc || '',
      credits: [],
      image: '',
      gallery: [],
      video: x.video || '',
      youtube: x.youtube || '',
      notes: [],
      draft: !!x.draft,
    })),
  ];
  return includeDrafts ? list : list.filter((r) => !r.draft);
}

/** Resolve a project (and its "next") by slug, with derived view fields. */
export function getProject(slug) {
  // Resolve against everything (so a draft's ?p= link still previews), but
  // pick "next" only among published projects — never link out to a draft.
  const all = getAllProjects({ includeDrafts: true });
  const published = all.filter((a) => !a.draft);

  const item = all.find((a) => a.slug === slug) || published[0] || all[0];
  const pubIdx = published.findIndex((a) => a.slug === item.slug);
  const next =
    published.length > 0
      ? published[(pubIdx >= 0 ? pubIdx + 1 : 0) % published.length]
      : item;
  const accent = getAccent(item.slug);

  // Real media: the designated hero leads, the rest become the gallery. The
  // still hero is used for the <img> hero slot (gallery loops can't fill it),
  // and everything else — stills, GIFs and video loops — follows below.
  const imgs = getImages(item.slug, baseName(item.image));
  const heroImg = imgs.find((url) => !isVideoSrc(url)) || '';
  const galleryImgs = imgs
    .filter((url) => url !== heroImg)
    .map((src, i) => ({
      src,
      video: isVideoSrc(src),
      alt: `${item.title || 'Frame'} — frame ${i + 1}`,
      wide: i === 0,
    }));

  return { item, next, accent, heroImg, galleryImgs };
}
