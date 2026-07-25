import data from '../data/projects.json';

/**
 * Build the archive list for a mode (all projects, not just featured),
 * sorted by year descending and grouped by year.
 * Work mode → work projects; Lab mode → lab projects.
 */
export function getArchiveGroups(mode) {
  const all = (mode === 'lab'
    ? data.lab
        .filter((x) => !x.draft) // drafts stay hidden until content is added
        .map((x) => ({
          num: `L·${x.code}`,
          title: x.title,
          cat: x.kind,
          year: x.year,
          href: `?p=${x.slug}`,
        }))
    : data.work
        .filter((p) => !p.draft)
        .map((p) => ({
          num: p.num,
          title: p.title,
          cat: p.category,
          year: p.year,
          href: `?p=${p.slug}`,
        }))
  )
    .slice()
    .sort((a, b) => (b.year || 0) - (a.year || 0));

  for (const r of all) r.year = r.year ? String(r.year) : '—';

  const groups = [];
  for (const r of all) {
    let g = groups[groups.length - 1];
    if (!g || g.year !== r.year) {
      g = { year: r.year, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
}
