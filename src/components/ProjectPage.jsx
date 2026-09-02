import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getProject } from '../lib/projectData';
import { parseCredit } from '../lib/people';
import { CURRENT_LOCATION } from '../lib/location';
import { useReveal } from '../hooks/useReveal';
import { useMagnetic } from '../hooks/useMagnetic';
import ProjectHeroCanvas from './ProjectHeroCanvas';
import Lightbox from './Lightbox';
import Compare from './Compare';
import { getCompares, getCompareLabels } from '../lib/compares';
import { getHeroVideo } from '../lib/heroVideo';
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

  // Title hover: chromatic aberration (CSS class) + glassy distortion (SVG
  // displacement, same language as the hero wordmark). Skipped on touch;
  // reduced motion keeps the static aberration but no warp.
  useEffect(() => {
    const el = titleBoxRef.current;
    const touch =
      window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (!el || touch) return undefined;

    const disp = document.getElementById('pd-disp');
    const turb = document.getElementById('pd-turb');
    let wobble;

    const enter = () => {
      el.classList.add('is-ab');
      if (reduced || !disp || !turb) return;
      gsap.killTweensOf(disp);
      gsap.to(disp, { attr: { scale: 5 }, duration: 0.45, ease: 'none' });
      gsap.set(turb, { attr: { baseFrequency: 0.008 } });
      wobble?.kill();
      wobble = gsap.to(turb, {
        attr: { baseFrequency: 0.013 },
        duration: 1.8,
        ease: 'none',
        repeat: -1,
        yoyo: true,
      });
    };
    const leave = () => {
      el.classList.remove('is-ab');
      if (reduced || !disp || !turb) return;
      wobble?.kill();
      wobble = null;
      gsap.killTweensOf(disp);
      gsap.to(disp, {
        attr: { scale: 0 },
        duration: 0.35,
        ease: 'none',
        onComplete: () => gsap.set(turb, { attr: { baseFrequency: 0.0001 } }),
      });
    };

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
      wobble?.kill();
    };
  }, [slug, reduced]);

  const meta = [
    ['Client', item.client],
    ['Year', item.year],
    ['Role', item.role],
    ['Platform', item.platform],
    ['Category', item.category],
  ];

  return (
    <>
      <nav className="nav is-scrolled" style={{ zIndex: 50 }}>
        <a href="./" data-cursor data-magnetic className="nav__brand">Ansh Chandpara</a>
        <div className="nav__links">
          <a href="./#work" data-cursor>← Projects</a>
          <a href="?page=about" data-cursor>About</a>
        </div>
      </nav>

      {/* SVG filter powering the glassy distortion on the title (identity
          warp until hover — same pattern as the hero wordmark). */}
      <svg className="pd__defs" aria-hidden="true" width="0" height="0">
        <defs>
          <filter
            id="pd-glass"
            x="-20%"
            y="-45%"
            width="140%"
            height="190%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              id="pd-turb"
              type="fractalNoise"
              baseFrequency="0.0001"
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              id="pd-disp"
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <main ref={revealRef} className="pd" data-screen-label="Project detail">
        {/* Letterbox backdrop behind the header — the project's own key frame,
            tilt-shifted (sharp band, blurred above/below) and veiled so the
            title stays legible. Skipped when a project has no imagery. */}
        {backdropImg && (
          <div className="pd__backdrop" aria-hidden="true">
            <img className="pd__backdrop-blur" src={backdropImg} alt="" />
            <img className="pd__backdrop-sharp" src={backdropImg} alt="" />
            <div className="pd__backdrop-veil" />
          </div>
        )}

        <p className="eyebrow" data-rv style={{ marginBottom: 20 }}>
          {item.num} — {item.category}
        </p>

        <h1 ref={titleBoxRef} className="pd__title" data-cursor>
          <span ref={titleRef} className="pd__title-line">{item.title}</span>
        </h1>

        {item.subtitle && <p className="pd__subtitle" data-rv>{item.subtitle}</p>}

        <dl className="pd__meta" data-rv>
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div
          ref={heroMediaRef}
          className={`pd__hero${heroVideo && !item.video ? ' pd__hero--bleed' : ''}`}
          style={{
            background: accent,
            // A film hero takes the FILM's shape, so it fits exactly with no bars
            // and no crop. Only when 88vh clamps it does the iframe have to cover.
            ...(item.video ? { '--video-aspect': item.videoAspect } : null),
          }}
        >
          {item.video ? (
            /* --video-aspect drives the cover sizing in ProjectPage.css. Without the
               film's own aspect the iframe can only letterbox or pillarbox in the hero. */
            <iframe
              className="pd__hero-video"
              title={`${item.title} — title sequence`}
              src={`https://player.vimeo.com/video/${item.video}?title=0&byline=0&portrait=0&dnt=1&color=d98b2b`}
              allow="autoplay; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : heroVideo ? (
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
            <>
              <ProjectHeroCanvas color={accent} />
              <div className="pd__hero-title">{item.title}</div>
            </>
          )}
        </div>

        <div className="pd__brief" data-rv>
          <p className="eyebrow">Brief</p>
          <p className="pd__desc">{item.desc || 'Project notes coming soon.'}</p>
        </div>

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
            <ul className="pd__credit-list">
              {item.credits.map((c) => {
                const { role, names } = parseCredit(c);
                return (
                  <li className="pd__credit" key={c}>
                    {role && <span className="pd__credit-role">{role}</span>}
                    <span className="pd__credit-people">
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
                    </span>
                  </li>
                );
              })}
            </ul>
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
    </>
  );
}
