import { useEffect, useMemo, useRef, useState } from 'react';
import { getProject } from '../../lib/projectData';
import { projectEntry, mediaUrl } from '../../lib/mediaManifest';
import { createScene, runwayVhFor } from './reveriesScene';
import './Reveries.css';

const TIER_RE = /\.(large|zoom)\.webp$/i;

/**
 * Reveries — a white room of floating drawings, as a SECTION.
 *
 * It lives in two places: under the lab hero on Home, where scrolling out of
 * the hero slides the room up over it and pins it while the walk plays out;
 * and on its own page (`?p=reveries`, lab/Reveries.jsx), which wraps this in
 * a nav and a footer. The section is as tall as the walk (`runwayVhFor`); the
 * stage inside it is `position: sticky` and one viewport tall, so the page's
 * own scroll is what drives the camera — no scroll-jacking, and the hero
 * above and the footer below are ordinary page flow.
 *
 * Owns: the scoped light theme (tokens on `.rv`, not on <body>, so a dark
 * page can host a white room), the canvas, the overlay UI, keyboard — gated
 * on the room being in view, so arrow keys over the hero do nothing here —
 * and the no-WebGL fallback. Everything three.js is in reveriesScene.js.
 */
export default function ReveriesRoom({ slug = 'reveries', standalone = false }) {
  const { item } = getProject(slug);

  // Base tier from the manifest; the other tiers are derived by name, so all
  // are things `media:verify` checks and none is a guess.
  const items = useMemo(() => {
    const files = projectEntry(slug).files.filter((f) => /\.webp$/i.test(f) && !TIER_RE.test(f));
    return files.map((f) => ({
      file: f,
      src: mediaUrl(slug, f),
      large: mediaUrl(slug, f.replace(/\.webp$/i, '.large.webp')),
      zoom: mediaUrl(slug, f.replace(/\.webp$/i, '.zoom.webp')),
    }));
  }, [slug]);

  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const inViewRef = useRef(standalone); // keyboard + render gate
  const [focused, setFocused] = useState(-1);
  const [loaded, setLoaded] = useState(0);
  const [noWebGL, setNoWebGL] = useState(false);
  const [disturbed, setDisturbed] = useState(false); // any piece moved from its slot
  const [legendOpen, setLegendOpen] = useState(false); // the controls popup
  const [zoom, setZoom] = useState(1); // on the focused piece; 1 = fitted

  // A popup closes when you press anywhere else — including the room itself.
  useEffect(() => {
    if (!legendOpen) return undefined;
    const close = (e) => { if (!e.target.closest?.('.rv__help')) setLegendOpen(false); };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [legendOpen]);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The scene.
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section || !items.length) return undefined;

    let scene;
    try {
      scene = createScene(canvas, items, {
        reducedMotion: reduced,
        onHover: (i) => {
          // Let the site cursor grow over a piece without touching Cursor.jsx:
          // it watches mouseover/mouseout for [data-cursor], so give it those.
          if (i >= 0) {
            canvas.setAttribute('data-cursor', '');
            canvas.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          } else {
            canvas.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
            canvas.removeAttribute('data-cursor');
          }
        },
        onFocus: setFocused,
        onLoad: setLoaded,
        onDisturb: () => setDisturbed(true),
        onZoom: setZoom,
      });
    } catch (e) {
      // No WebGL (or a blocked context). Show the work anyway.
      setNoWebGL(true);
      return undefined;
    }
    sceneRef.current = scene;
    canvas.__reveries = scene; // verification handle only — nothing reads it

    const onMove = (e) => {
      scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    // Progress through the SECTION, not the page: 0 when its top reaches the
    // viewport top (the stage has just pinned), 1 when its bottom does.
    //
    // Embedded under the hero, the room also ENTERS and LEAVES: over the one
    // viewport of scroll in which it slides up over the hero, its ground goes
    // from the site's dark to white (so the sheet has no visible edge — it is
    // dark on dark until it starts to brighten), and over the last viewport
    // of the walk it goes back to dark before the footer. The UI rides the
    // same ramp. Standalone, the page is white already: no ramps.
    const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const range = section.offsetHeight - vh;
      scene.setScroll(range > 0 ? -rect.top / range : 0);
      if (standalone) return;
      const enter = smooth((vh - rect.top) / vh);            // 0 at the fold → 1 pinned
      const leave = smooth((-rect.top - (range - vh)) / vh); // 0 until the last viewport → 1 at the end
      const g = enter * (1 - leave);
      scene.setGround(g);
      section.style.setProperty('--rv-ground', g.toFixed(3));
      // The soft top: while sliding in, the stage fades up from transparent
      // over its top part, so the hero shows through the seam instead of
      // meeting a brightening room along a hard line. Gone once pinned.
      section.style.setProperty('--rv-edge', `${((1 - enter) * 45).toFixed(1)}%`);
    };
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { scene.resize(); onScroll(); });
    };
    const onKey = (e) => {
      if (!inViewRef.current) return; // the room is not what the visitor is looking at
      if (e.key === 'Escape') scene.blur();
      else if (e.key === 'ArrowRight') scene.next();
      else if (e.key === 'ArrowLeft') scene.prev();
      else if (e.key === '+' || e.key === '=') scene.zoomIn();
      else if (e.key === '-' || e.key === '_') scene.zoomOut();
      else if (e.key === '0') scene.zoomReset();
    };
    // Render only while the stage is on screen. On Home the hero has its own
    // WebGL and video above this; two scenes ticking for one visible is waste.
    const io = new IntersectionObserver(([entry]) => {
      // Two gates from one observer: render as soon as any of it shows (the
      // room slides up over the hero and must already be drawn), but only
      // take the keyboard once it is most of the screen — a strip of white
      // peeking above the fold is not what the visitor is looking at.
      scene.setVisible(entry.isIntersecting);
      inViewRef.current = entry.intersectionRatio >= 0.5;
      if (!entry.isIntersecting && scene.focused >= 0) scene.blur();
    }, { threshold: [0, 0.05, 0.5, 0.51] });
    io.observe(canvas);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    if (!standalone) { scene.setGround(0); section.style.setProperty('--rv-ground', '0'); section.style.setProperty('--rv-edge', '45%'); }
    onScroll();
    scene.resize();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, reduced]);

  const count = items.length;
  const nn = (i) => String(i + 1).padStart(2, '0');

  return (
    // The section is the runway; the stage pins inside it for the whole walk.
    <section
      id="reveries"
      ref={sectionRef}
      className={`rv${focused >= 0 ? ' is-focused' : ''}${standalone ? ' rv--page' : ''}`}
      style={{ height: noWebGL ? 'auto' : `${runwayVhFor(count)}vh` }}
      data-screen-label="Reveries"
    >
      {noWebGL ? (
        /* Honest degrade: the same drawings, as a grid, on white. */
        <div className="rv__grid">
          {items.map((it, i) => (
            <figure key={it.file} className="rv__cell">
              <img src={it.large} alt={`${item.title} ${nn(i)}`} loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      ) : (
        <div className="rv__stage">
          <canvas ref={canvasRef} className="rv__canvas" aria-label={`${item.title}: ${count} drawings in a 3D space`} />

          <div className="rv__ui">
            <div className="rv__top">
              <p className="eyebrow rv__eyebrow">
                {item.title} · {item.category} · {item.year}
                {loaded < count && (
                  <span className="rv__load" aria-live="polite"> · {loaded}/{count}</span>
                )}
              </p>
            </div>

            <div className="rv__focus">
              {/* Bottom-left: the index label while a drawing is forward, the
                  controls popup otherwise — they never show together. */}
              <div className="rv__corner">
                <span className="rv__index" aria-live="polite">
                  {focused >= 0 ? `${nn(focused)} / ${String(count).padStart(2, '0')}` : ''}
                  {focused >= 0 && zoom > 1.05 && <span className="rv__zoom">{zoom.toFixed(1)}×</span>}
                </span>
                <div className={`rv__help${legendOpen ? ' is-open' : ''}`} aria-hidden={focused >= 0}>
                  <button type="button" className="rv__help-toggle" data-cursor
                    aria-expanded={legendOpen} aria-controls="rv-legend"
                    onClick={() => setLegendOpen((v) => !v)}>Controls</button>
                  {/* Two lists, one shown: CSS picks by (hover: hover) / (hover: none),
                      which is the honest test for "is there a mouse" — a phone with
                      a mouse attached gets the mouse list. */}
                  <dl id="rv-legend" className="rv__legend" data-input="mouse">
                    <dt>Click</dt><dd>Bring a drawing forward</dd>
                    <dt>Drag</dt><dd>Move it</dd>
                    <dt>Shift-drag · right-drag</dt><dd>Turn it</dd>
                    <dt>Scroll</dt><dd>Walk through the room</dd>
                    <dt>Wheel · double-click</dt><dd>Zoom, once a drawing is forward</dd>
                    <dt>← → · Esc</dt><dd>Step through · close</dd>
                  </dl>
                  <dl className="rv__legend" data-input="touch">
                    <dt>Tap</dt><dd>Bring a drawing forward</dd>
                    <dt>Drag a drawing</dt><dd>Move it</dd>
                    <dt>Drag empty space</dt><dd>Walk through the room</dd>
                    <dt>Pinch · double-tap</dt><dd>Zoom, once a drawing is forward</dd>
                    <dt>Tap again</dt><dd>Close</dd>
                  </dl>
                </div>
              </div>
              <div className="rv__controls">
                {disturbed && focused < 0 && (
                  <button type="button" className="rv__btn rv__btn--text" data-cursor
                    onClick={() => { sceneRef.current?.reset(); setDisturbed(false); }}>Reset room</button>
                )}
                {focused >= 0 && (
                  <>
                    <button type="button" className="rv__btn" data-cursor onClick={() => sceneRef.current?.zoomOut()} aria-label="Zoom out" disabled={zoom <= 1.001}>−</button>
                    <button type="button" className="rv__btn" data-cursor onClick={() => sceneRef.current?.zoomIn()} aria-label="Zoom in">+</button>
                    <button type="button" className="rv__btn" data-cursor onClick={() => sceneRef.current?.prev()} aria-label="Previous drawing">‹</button>
                    <button type="button" className="rv__btn" data-cursor onClick={() => sceneRef.current?.next()} aria-label="Next drawing">›</button>
                    <button type="button" className="rv__btn rv__btn--close" data-cursor onClick={() => sceneRef.current?.blur()} aria-label="Close">×</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
