import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { getWorkCards, sortCards, SORTS } from '../lib/workCards';
import { useMagnetic } from '../hooks/useMagnetic';
import CardCanvas from './CardCanvas';
import './Work.css';

// Density by viewport — `columns` (from Home) is the cap at the widest size.
const breakpointCols = (w) => (w < 640 ? 1 : w < 1024 ? 2 : w < 1440 ? 3 : 4);

/** Column count for the current viewport, capped by `max`. */
function useColumns(max) {
  const read = () =>
    typeof window === 'undefined' ? max : Math.min(max, breakpointCols(window.innerWidth));
  const [cols, setCols] = useState(read);
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setCols(read());
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);
  return cols;
}

function ProjectCard({ card }) {
  // If a real image is present but fails to load, fall back to the shader panel.
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = card.hasImg && !imgFailed;

  return (
    <article data-fcard className="fcard">
      <a href={card.href} data-cursor data-cursor-label="View" className="fcard__link">
        <div className="fcard__media" style={{ aspectRatio: card.ar }}>
          {/* Image sits under a frosted-glass panel; hover clears the glass. */}
          {showImg ? (
            <img
              className="fcard__img"
              src={card.img}
              alt={card.title}
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <CardCanvas color={card.accent} />
          )}
          <div className="fcard__glass" />
          <div className="fcard__scrim" />

          {/* Default state — the title fills the box, over the frosted glass. */}
          <div className="fcard__cover">
            <span className="fcard__num">{card.num}</span>
            <div className="fcard__cover-foot">
              <h3 className="fcard__title">{card.title}</h3>
              <p className="fcard__meta">{card.metaLine}</p>
            </div>
          </div>

          {/* Caption over the revealed image. */}
          <div className="fcard__caption">
            <h3 className="fcard__ctitle">{card.title}</h3>
            <p className="fcard__cmeta">{card.metaLine}</p>
          </div>
        </div>
      </a>
    </article>
  );
}

export default function Work({ columns = 4 }) {
  const cols = useColumns(Math.max(1, Math.min(4, Math.round(columns))));
  const all = useMemo(() => getWorkCards(), []); // every published project
  const [sort, setSort] = useState('index');
  const cards = useMemo(() => sortCards(all, sort), [all, sort]);

  const gridRef = useRef(null);
  const sentinelRef = useRef(null);
  const allWorkRef = useMagnetic();

  // Infinite scroll: start with a couple of rows, extend as the sentinel nears.
  const batch = Math.max(4, cols * 2);
  const [visible, setVisible] = useState(() => Math.min(8, all.length));
  const shown = cards.slice(0, visible);

  // Re-sorting keeps however many cards are already loaded (resetting the count
  // mid-scroll would yank content out from under the reader). Old reveal
  // triggers are dropped in the reveal effect below, since every card remounts.

  // Fixed round-robin columns (not CSS multicolumn — that rebalances on every
  // append and would reshuffle already-visible cards mid-scroll). Cards keep
  // page order left-to-right, top-to-bottom; the aspect-ratio cycle staggers
  // the columns like the original masonry.
  const colBuckets = Array.from({ length: cols }, () => []);
  shown.forEach((card, i) => colBuckets[i % cols].push(card));

  useEffect(() => {
    if (visible >= cards.length) return undefined;
    const el = sentinelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setVisible((v) => Math.min(v + batch, cards.length));
      },
      { rootMargin: '700px 0px' } // load ahead, before the gap is ever seen
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, cards.length, batch]);

  // Scroll reveal — a plain position check, deliberately not ScrollTrigger or
  // IntersectionObserver. Both only react to a *crossing*: a card that goes
  // from below the fold to above it in one jump (fast scroll, anchor jump,
  // re-sort, appended batch) never crosses, and stayed invisible forever.
  // Here anything at-or-above the reveal line is simply due, however it got
  // there. Cards are marked `data-fr-done` once handled, and the listener
  // detaches as soon as nothing is pending.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    let pending = Array.from(grid.querySelectorAll('[data-fcard]')).filter(
      (el) => !el.dataset.frDone
    );
    if (!pending.length) return undefined;

    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set(pending, { opacity: 1, y: 0 });
      pending.forEach((el) => (el.dataset.frDone = '1'));
      return undefined;
    }

    gsap.set(pending, { opacity: 0, y: 22 });

    let raf = 0;
    const check = () => {
      raf = 0;
      const line = window.innerHeight * 0.92;
      const due = [];
      const rest = [];
      for (const el of pending) {
        (el.getBoundingClientRect().top < line ? due : rest).push(el);
      }
      if (due.length) {
        due.forEach((el) => (el.dataset.frDone = '1'));
        gsap.to(due, { opacity: 1, y: 0, duration: 0.42, ease: 'none', stagger: 0.05 });
      }
      pending = rest;
      if (!pending.length) detach();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const detach = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    check(); // first pass: reveal whatever is already at/above the line

    return () => {
      detach();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [visible, cols, sort]);

  return (
    <section id="work" className="section work" data-screen-label="Index">
      <div className="work__head">
        <h2 className="work__title">All work</h2>
        <div className="work__tools">
          <p className="eyebrow work__eyebrow">
            01 — Index · {String(cards.length).padStart(2, '0')}
          </p>
          <div className="work__sort" role="group" aria-label="Sort projects">
            <span className="work__sort-label">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`work__sort-btn${sort === s.key ? ' is-active' : ''}`}
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                data-cursor
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={gridRef} className="work__grid" data-cols={cols}>
        {colBuckets.map((bucket, ci) => (
          <div key={ci} className="work__col">
            {bucket.map((card) => (
              <ProjectCard key={card.slug} card={card} />
            ))}
          </div>
        ))}
      </div>

      {visible < cards.length && (
        <div ref={sentinelRef} className="work__sentinel" aria-hidden="true" />
      )}

      <div className="work__foot">
        <a ref={allWorkRef} href="?page=about#archive" data-cursor data-magnetic className="work__all">
          <span>Archive</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
