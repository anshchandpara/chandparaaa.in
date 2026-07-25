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

        <div ref={heroMediaRef} className="pd__hero" style={{ background: accent }}>
          {item.video ? (
            <iframe
              className="pd__hero-video"
              title={`${item.title} — title sequence`}
              src={`https://player.vimeo.com/video/${item.video}?title=0&byline=0&portrait=0&dnt=1&color=d98b2b`}
              allow="autoplay; fullscreen; picture-in-picture"
              loading="lazy"
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

        {galleryImgs.length > 0 ? (
          <div className="pd__gallery">
            {galleryImgs.map((gi, i) => (
              <div
                key={gi.src}
                className={`pd__frame${gi.wide ? ' pd__frame--wide' : ''}`}
                data-rv
              >
                <img
                  src={gi.src}
                  alt={gi.alt}
                  data-cursor
                  data-cursor-label="Expand"
                  onClick={() => setLbIndex(lbOffset + i)}
                />
              </div>
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
        <span>Director · Title Designer · Filmmaker</span>
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
