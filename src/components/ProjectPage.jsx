import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getProject } from '../lib/projectData';
import { mediaUrl } from '../lib/mediaManifest';
import { parseCredit } from '../lib/people';
import { CURRENT_LOCATION } from '../lib/location';
import { useReveal } from '../hooks/useReveal';
import { useMagnetic } from '../hooks/useMagnetic';
import { useTitleFit } from '../hooks/useTitleFit';
import ProjectHeroCanvas from './ProjectHeroCanvas';
import Lightbox from './Lightbox';
import Compare from './Compare';
import { getCompares, getCompareLabels } from '../lib/compares';
import { getHeroVideo } from '../lib/heroVideo';
import Brand from './Brand';
import './ProjectPage.css';

gsap.registerPlugin(ScrollTrigger);

const SLOTS = [
  { id: 'f1', ar: '4 / 5', label: 'Drop frame 01' },
  { id: 'f2', ar: '4 / 5', label: 'Drop frame 02' },
  { id: 'f3', ar: '21 / 9', label: 'Drop a wide frame — 21:9', wide: true },
];

export default function ProjectPage({ slug }) {
  const { item, next, accent, heroImg, galleryImgs } = getProject(slug);
  const revealRef = useReveal([slug]);
  const titleRef = useRef(null);
  const titleBoxRef = useRef(null);
  const heroImgRef = useRef(null);
  const heroMediaRef = useRef(null);
  const nextRef = useMagnetic();

  // Lightbox: every still on the page, in page order (hero first when it's an
  // image hero; with a video hero only the gallery frames are on the page).
  const lbImages = [
    ...(!item.video && heroImg ? [{ src: heroImg, alt: item.title }] : []),
    ...galleryImgs.map((gi) => ({ src: gi.src, alt: gi.alt })),
  ];
  const lbOffset = !item.video && heroImg ? 1 : 0; // gallery index -> lbImages index
  const [lbIndex, setLbIndex] = useState(-1);
  // The episode sequences open in the same mode, as their own set: a Vimeo
  // player where a film has landed, the reserved slot where it hasn't.
  const seqItems = item.sequences.map((q, i) => ({
    ...(q.video ? { vimeo: q.video } : { reserved: true }),
    label: q.label || `Sequence ${String(i + 1).padStart(2, '0')}`,
    poster: q.poster ? mediaUrl(item.slug, q.poster) : '',
  }));
  const [seqIndex, setSeqIndex] = useState(-1);

  const compares = getCompares(slug); // before/after VFX pairs, if any
  const cmpLabels = getCompareLabels(slug);
  const heroVideo = getHeroVideo(slug); // self-hosted hero loop, if present

  // Frame for the letterbox header backdrop. With a video hero the still hero
  // isn't rendered anywhere else, so it's the natural pick; otherwise take a
  // mid-gallery still so the band doesn't just repeat the hero underneath it.
  // Text breaks, bucketed by the gallery index they sit before. Anything
  // positioned beyond the last frame is rendered after the grid.
  const notesByIndex = new Map();
  const trailingNotes = [];
  for (const n of item.notes || []) {
    if (n.after >= galleryImgs.length) trailingNotes.push(n);
    else {
      const arr = notesByIndex.get(n.after) || [];
      arr.push(n);
      notesByIndex.set(n.after, arr);
    }
  }

  const backdropImg = (() => {
    if (heroVideo) return heroImg;
    const stills = galleryImgs.filter((g) => !g.video).map((g) => g.src);
    return stills.length ? stills[Math.floor(stills.length / 2)] : heroImg;
  })();

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Size the title to its own length FIRST. Declared before the clip-rise
  // below because React runs layout effects in declaration order, and the
  // rise's yPercent resolves against the height this sets. Also the fix for
  // the crop: the mask clips horizontally as well as vertically, so a word
  // wider than the column was being cut off mid-letter.
  useTitleFit(titleBoxRef, [slug]);

  // Title rises from a clip mask on load.
  useLayoutEffect(() => {
    if (reduced || !titleRef.current) return;
    gsap.set(titleRef.current, { yPercent: 115 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (reduced) return undefined;
    const tweens = [];
    if (titleRef.current) {
      tweens.push(
        gsap.to(titleRef.current, { yPercent: 0, duration: 0.6, ease: 'none', delay: 0.1 })
      );
    }
    // Subtle parallax on the hero image (scrubbed).
    let st;
    if (heroImgRef.current && heroMediaRef.current) {
      st = gsap.to(heroImgRef.current, {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: heroMediaRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }
    return () => {
      tweens.forEach((t) => t.kill());
      if (st) st.kill();
    };
  }, [slug, reduced]);

  // Scroll to top whenever the project changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);


  // Category is the accent eyebrow above the title now, so listing it again here
  // put the same words twice in one block.
  const meta = [
    ['Client', item.client],
    ['Year', item.year],
    ['Role', item.role],
    ['Platform', item.platform],
  ];

  return (
    <>
      <nav className="nav is-scrolled" style={{ zIndex: 50 }}>
        <Brand />
        <div className="nav__links">
          <a href="./#work" data-cursor>← Projects</a>
          <a href="?page=about" data-cursor>About</a>
        </div>
      </nav>

      {/* SVG filter powering the glassy distortion on the title (identity
          warp until hover — same pattern as the hero wordmark). */}

      <main ref={revealRef} className="pd" data-screen-label="Project detail">
        <div
          ref={heroMediaRef}
          className="pd__hero"
        >
          {/* A STILL leads, never the film.

              These are title sequences: the film carries its own designed title,
              so putting the project name over it — or making it the hero at all —
              sets our typography against the work's. The film gets its own inset
              section below, where the player chrome reads as a player and the
              frame is unambiguously the thing being shown. */}
          {heroVideo ? (
            <video
              ref={heroImgRef}
              className="pd__hero-img pd__hero-loop"
              src={heroVideo}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
            />
          ) : heroImg ? (
            <img
              ref={heroImgRef}
              className="pd__hero-img"
              src={heroImg}
              alt={item.title}
              data-cursor
              data-cursor-label="Expand"
              onClick={() => setLbIndex(0)}
            />
          ) : (
            <ProjectHeroCanvas color={accent} />
          )}
        </div>

        {/* Letterbox backdrop. Its job was to give the header something to sit on
            at the top of the page. The hero now opens the page and the header sits
            below the fold on plain ground, so this only renders for a project with
            NO hero media — where there is still a bare header to carry. */}
        {backdropImg && !item.video && !heroVideo && !heroImg && (
          <div className="pd__backdrop" aria-hidden="true">
            <img className="pd__backdrop-blur" src={backdropImg} alt="" />
            <img className="pd__backdrop-sharp" src={backdropImg} alt="" />
            <div className="pd__backdrop-veil" />
          </div>
        )}

        {/* The eyebrow and title now live over the hero. Repeating them here put
            the same words on screen twice, one directly under the other. What
            belongs below the fold is the subtitle and the metadata.

            The h1 stays — as a visually-hidden heading, so the page keeps one
            real document heading for assistive tech and search, which the
            overlaid div is not. */}
        {/* Identity. Two columns: who and what on the left, the story on the
            right. Replaces a full-width dl followed by a separate brief block —
            the same facts, read in one pass instead of two. */}
        <div className="pd__id" data-rv>
          <div className="pd__id-main">
            <p className="eyebrow pd__id-eyebrow">{item.category}</p>
            <h1 ref={titleBoxRef} className="pd__title" data-cursor>
              <span ref={titleRef} className="pd__title-line">{item.title}</span>
            </h1>
            {item.subtitle && <p className="pd__subtitle">{item.subtitle}</p>}
            <dl className="pd__meta">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="pd__id-desc">
            <p className="pd__desc">{item.desc || 'Project notes coming soon.'}</p>
          </div>
        </div>

        {/* The film, inset. Not full-bleed and not the hero: a contained player
            reads as "press play on the work" rather than as page furniture. */}
        {item.video && (
          <div className="pd__film" data-rv>
            <p className="eyebrow pd__film-label">Title sequence</p>
            <div
              className="pd__film-frame"
              style={{ '--video-aspect': item.videoAspect }}
            >
              <iframe
                className="pd__film-video"
                title={`${item.title} — title sequence`}
                src={`https://player.vimeo.com/video/${item.video}?title=0&byline=0&portrait=0&dnt=1&color=d98b2b`}
                allow="autoplay; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Several title sequences (one per episode): a grid of tiles, four
            across, each opening the gallery mode on its own film. Tiles with no
            film yet are drawn as reserved space so the page already holds the
            shape of the finished set — and they open too, so the mode is one
            thing, not two. A tile shows its `poster` (a project frame) once
            one is named; until then, its label. */}
        {seqItems.length > 0 && (
          <div className="pd__seqs" data-rv>
            <p className="eyebrow pd__film-label">
              Title sequences · {String(seqItems.length).padStart(2, '0')}
            </p>
            <div className="pd__seqs-grid">
              {seqItems.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  className={`pd__seq${q.reserved ? ' pd__seq--reserved' : ''}`}
                  onClick={() => setSeqIndex(i)}
                  data-cursor
                  data-cursor-label={q.reserved ? 'Open' : 'Play'}
                  aria-label={`${q.label}${q.reserved ? ' — reserved' : ''}`}
                >
                  {q.poster && <img src={q.poster} alt="" loading="lazy" draggable="false" />}
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {item.youtube && (
          <div className="pd__watch" data-rv>
            <a
              href={item.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="pd__watch-link"
              data-cursor
              data-magnetic
            >
              <span className="pd__watch-eyebrow">Watch</span>
              <span className="pd__watch-title">The full film on YouTube</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M7 17L17 7M17 7H8M17 7v9" />
              </svg>
            </a>
          </div>
        )}

        {compares.length > 0 && (
          <div className="pd__compares" data-rv>
            <p className="eyebrow pd__compares-label">
              {cmpLabels.heading} · drag to compare
            </p>
            {compares.map((c, i) => (
              <Compare
                key={i}
                before={c.before}
                after={c.after}
                video={c.video}
                labelBefore={cmpLabels.before}
                labelAfter={cmpLabels.after}
              />
            ))}
          </div>
        )}

        {galleryImgs.length > 0 ? (
          <div className="pd__gallery">
            {galleryImgs.map((gi, i) => (
              <Fragment key={gi.src}>
                {/* Text breaks land *before* the frame at their index, so
                    `after: 2` reads as "after the first two frames". */}
                {notesByIndex.get(i)?.map((n, ni) => (
                  <aside className="pd__note" key={`n${i}-${ni}`} data-rv>
                    {n.label && <p className="eyebrow pd__note-label">{n.label}</p>}
                    <p className="pd__note-text">{n.text}</p>
                  </aside>
                ))}
              <div
                className={`pd__frame${gi.wide ? ' pd__frame--wide' : ''}`}
                data-rv
              >
                {gi.video ? (
                  <video
                    src={gi.src}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                    data-cursor
                    data-cursor-label="Expand"
                    onClick={() => setLbIndex(lbOffset + i)}
                  />
                ) : (
                  <img
                    src={gi.src}
                    alt={gi.alt}
                    data-cursor
                    data-cursor-label="Expand"
                    onClick={() => setLbIndex(lbOffset + i)}
                  />
                )}
              </div>
              </Fragment>
            ))}
            {/* Any notes positioned past the last frame land at the end. */}
            {trailingNotes.map((n, ni) => (
              <aside className="pd__note" key={`nt${ni}`} data-rv>
                {n.label && <p className="eyebrow pd__note-label">{n.label}</p>}
                <p className="pd__note-text">{n.text}</p>
              </aside>
            ))}
          </div>
        ) : (
          <div className="pd__slots">
            {SLOTS.map((s) => (
              <div
                key={s.id}
                className={`pd__slot${s.wide ? ' pd__slot--wide' : ''}`}
                style={{ aspectRatio: s.ar }}
                data-rv
              >
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Projects with no imagery have no gallery grid to host the breaks,
            so render them on their own. */}
        {galleryImgs.length === 0 && (item.notes || []).length > 0 && (
          <div className="pd__notes-solo">
            {item.notes.map((n, ni) => (
              <aside className="pd__note" key={`ns${ni}`} data-rv>
                {n.label && <p className="eyebrow pd__note-label">{n.label}</p>}
                <p className="pd__note-text">{n.text}</p>
              </aside>
            ))}
          </div>
        )}

        {item.credits.length > 0 && (
          <div className="pd__credits" data-rv>
            <p className="eyebrow pd__credits-label">Credits</p>
            <dl className="pd__credit-list">
              {item.credits.map((c) => {
                const { role, names } = parseCredit(c);
                return (
                  <Fragment key={c}>
                    <dt className="pd__credit-role">{role || ''}</dt>
                    <dd className="pd__credit-people">
                      {names.map((p, i) => {
                        const cls = `pd__name${p.self ? ' is-self' : ''}`;
                        const node = p.url ? (
                          <a
                            className={cls}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-cursor
                          >
                            {p.name}
                          </a>
                        ) : (
                          <span className={cls}>{p.name}</span>
                        );
                        return (
                          <Fragment key={p.name + i}>
                            {node}
                            {i < names.length - 1 && <span className="pd__credit-sep">, </span>}
                          </Fragment>
                        );
                      })}
                    </dd>
                  </Fragment>
                );
              })}
            </dl>
          </div>
        )}

        <div className="pd__next">
          <p className="eyebrow" data-rv style={{ marginBottom: 18 }}>Next</p>
          <a ref={nextRef} href={`?p=${next.slug}`} data-cursor data-magnetic className="pd__next-link">
            <span>{next.title}</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </main>

      <footer className="foot">
        <span>© 2026 Chandparaaa</span>
        <span>Creative Director · Title Designer · Filmmaker</span>
        <span>{CURRENT_LOCATION.city}, {CURRENT_LOCATION.country}</span>
      </footer>

      {lbIndex >= 0 && (
        <Lightbox
          images={lbImages}
          index={lbIndex}
          onClose={() => setLbIndex(-1)}
          onNavigate={setLbIndex}
        />
      )}
      {seqIndex >= 0 && (
        <Lightbox
          images={seqItems}
          index={seqIndex}
          onClose={() => setSeqIndex(-1)}
          onNavigate={setSeqIndex}
        />
      )}
    </>
  );
}
