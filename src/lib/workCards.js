import data from '../data/projects.json';
import { getAccent } from './accents';
import { getHero, baseName } from './images';

// Modular ratio set — portrait/square modules punctuated by wide 21:9 letterbox
// cards, which compact the columns and break up the vertical rhythm. Seven
// steps (coprime with 2, 3 and 4 columns) so the stagger never lines up into
// identical rows at any density.
const WORK_AR = ['4 / 5', '21 / 9', '1 / 1', '3 / 4', '21 / 9', '4 / 5', '1 / 1'];

export function getWorkCards() {
  return data.work
    .filter((p) => !p.draft) // every published project (drafts stay hidden)
    .map((p) => {
      // Real imagery when available (designated hero first), else shader panel.
      const img = getHero(p.slug, baseName(p.image));
      return {
        ...p,
        href: `?p=${p.slug}`,
        accent: getAccent(p.slug),
        metaLine: [p.category, p.platform || p.client || p.role]
          .filter(Boolean)
          .join(' · '),
        hasImg: !!img,
        img,
      };
    });
}

/**
 * Assign module ratios by *display position*, not by card — so the modular
 * rhythm holds no matter how the grid is sorted.
 */
export function withRatios(cards) {
  return cards.map((c, i) => ({ ...c, ar: WORK_AR[i % WORK_AR.length] }));
}

// Year comparator. Several projects have no year yet — those always sort to
// the END (in both directions), never masquerading as the oldest work.
const byYear = (desc) => (a, b) => {
  const ay = a.year || 0;
  const by = b.year || 0;
  if (!ay !== !by) return ay ? -1 : 1;
  return desc ? by - ay : ay - by;
};

/** Sort modes offered above the grid. `null` comparator = curated order. */
export const SORTS = [
  { key: 'index', label: 'Index', cmp: null },
  { key: 'newest', label: 'Newest', cmp: byYear(true) },
  { key: 'oldest', label: 'Oldest', cmp: byYear(false) },
  { key: 'az', label: 'A–Z', cmp: (a, b) => a.title.localeCompare(b.title) },
  { key: 'category', label: 'Type', cmp: (a, b) => (a.category || '').localeCompare(b.category || '') },
];

/** Stable sort (ties keep curated order) + position-based ratios. */
export function sortCards(cards, key) {
  const mode = SORTS.find((s) => s.key === key) || SORTS[0];
  const out = mode.cmp ? cards.slice().sort(mode.cmp) : cards.slice();
  return withRatios(out);
}
