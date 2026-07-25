import { getArchiveGroups } from '../lib/archive';
import { useReveal } from '../hooks/useReveal';
import './Archive.css';

export default function Archive({ mode = 'work' }) {
  const groups = getArchiveGroups(mode);
  const ref = useReveal([mode]);

  return (
    <section ref={ref} id="archive" className="section archive" data-screen-label="Archive">
      <div className="archive__head">
        <h2 className="archive__title" data-rv>Archive</h2>
        <p className="eyebrow archive__eyebrow" data-rv>02 — By year</p>
      </div>

      <div>
        {groups.map((g) => (
          <div key={g.year} className="archive__group" data-rv>
            <div className="archive__year">{g.year}</div>
            <div className="archive__rows">
              {g.items.map((r) => (
                <a key={r.num + r.title} href={r.href} data-cursor className="archive__row">
                  <span className="archive__num">{r.num}</span>
                  <span className="archive__name">{r.title}</span>
                  <span className="archive__cat">{r.cat}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
