import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getWorkCards } from '../lib/workCards';
import { useMagnetic } from '../hooks/useMagnetic';
import CardCanvas from './CardCanvas';
import './Work.css';

gsap.registerPlugin(ScrollTrigger);

const BATCH = 6; // cards revealed per infinite-scroll step

function ProjectCard({ card }) {
  // If a real image is present but fails to load, fall back to the shader panel.
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = card.hasImg && !imgFailed;

  return (
    <article data-fcard className="fcard">
      <a href={card.href} data-cursor data-cursor-label="View" className="fcard__link">
        <div className="fcard__media" style={{ aspectRatio: card.ar, background: card.accent }}>
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
          <span className="fcard__num">{card.num}</span>
        </div>
        <div className="fcard__caption">
          <h3 className="fcard__title">{card.title}</h3>
          <p className="fcard__meta">{card.metaLine}</p>
        </div>
      </a>
    </article>
  );
}

export default function Work({ columns = 2 }) {
  const cols = Math.max(2, Math.min(4, Math.round(columns)));
  const cards = getWorkCards(); // every published project
  const gridRef = useRef(null);
  const sentinelRef = useRef(null);
  const triggersRef = useRef([]);
  const allWorkRef = useMagnetic();

  // Infinite scroll: start with one batch, extend as the sentinel approaches.
  const [visible, setVisible] = useState(Math.min(BATCH, cards.length));
  const shown = cards.slice(0, visible);

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
          setVisible((v) => Math.min(v + BATCH, cards.length));
      },
      { rootMargin: '700px 0px' } // load ahead, before the gap is ever seen
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, cards.length]);

  // Scroll reveal — register only cards not yet processed, so earlier batches
  // keep their triggers and appended cards animate in like the originals.
  useEffect(() => {
    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = gsap.utils
      .toArray('[data-fcard]', gridRef.current)
      .filter((el) => !el.dataset.frInit);
    if (!els.length) return;
    els.forEach((el) => {
      el.dataset.frInit = '1';
    });

    if (reduced) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(els, { opacity: 0, y: 22 });
    triggersRef.current.push(
      ...ScrollTrigger.batch(els, {
        start: 'top 92%',
        onEnter: (batchEls) =>
          gsap.to(batchEls, { opacity: 1, y: 0, duration: 0.42, ease: 'none', stagger: 0.05 }),
      })
    );
    ScrollTrigger.refresh();
  }, [visible, cols]);

  // Kill all reveal triggers only on unmount (between batches they must live).
  useEffect(() => () => triggersRef.current.forEach((t) => t.kill()), []);

  return (
    <section id="work" className="section work" data-screen-label="Index">
      <div className="work__head">
        <h2 className="work__title">All work</h2>
        <p className="eyebrow work__eyebrow">01 — Index</p>
      </div>

      <div ref={gridRef} className="work__grid">
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
