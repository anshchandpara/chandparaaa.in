import data from '../data/projects.json';
import { getAccent } from './accents';
import { getHero, baseName } from './images';

// Aspect ratios cycle to create the asymmetric masonry stagger.
const WORK_AR = ['16 / 10', '3 / 4', '4 / 5', '16 / 11', '1 / 1', '3 / 4'];

export function getWorkCards() {
  return data.work
    .filter((p) => !p.draft) // every published project (drafts stay hidden)
    .map((p, i) => {
      // Real imagery when available (designated hero first), else shader panel.
      const img = getHero(p.slug, baseName(p.image));
      return {
        ...p,
        href: `?p=${p.slug}`,
        accent: getAccent(p.slug),
        metaLine: [p.category, p.platform || p.client || p.role]
          .filter(Boolean)
          .join(' · '),
        ar: WORK_AR[i % WORK_AR.length],
        hasImg: !!img,
        img,
      };
    });
}
