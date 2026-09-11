import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getProject } from '../../lib/projectData';
import { projectEntry, mediaUrl } from '../../lib/mediaManifest';
import { CURRENT_LOCATION } from '../../lib/location';
import { createScene, runwayVhFor } from './reveriesScene';
import './Reveries.css';

const TIER_RE = /\.(large|zoom)\.webp$/i;

/**
 * Reveries — a white room of floating ink drawings. Lab entry with its own
 * page (see lab/pages.js).
 *
 * The React shell owns: the light theme on <body>, the fixed canvas, the
 * scroll driver that makes "scroll = walk forward" work, the DOM overlay
 * (eyebrow, focus caption, controls), keyboard, and the no-WebGL fallback.
 * Everything three.js lives in reveriesScene.js.
 */
export default function Reveries({ slug }) {
  const { item } = getProject(slug);

  // Base tier from the manifest; the large tier is derived by name, so both
  // are things `media:verify` checks and neither is a guess.
  const items = useMemo(() => {
    const files = projectEntry(slug).files.filter((f) => /\.webp$/i.test(f) && !TIER_RE.test(f));
    return files.map((f) => ({
      file: f,
      src: mediaUrl(slug, f),
      large: mediaUrl(slug, f.replace(/\.webp$/i, '.large.webp')),
      zoom: mediaUrl(slug, f.replace(/\.webp$/i, '.zoom.webp')),
    }));
  }, [slug]);

  const canvasRef = useRef(null);
  const driverRef = useRef(null);
  const sceneRef = useRef(null);
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

  // White room. Layout effect so the first paint is already white — a dark
  // frame before the swap would flash.
  //
  // <html> needs its own treatment: lib/design.js `applyDesign()` writes --bg
  // as an INLINE style on the root element, and no stylesheet rule — not even
  // `:root:has(body.theme-light)` — beats an inline declaration. Without this,
  // body is white but the html behind it stays dark, which shows as a dark
  // flash on macOS rubber-band overscroll. Restored exactly on unmount.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const prevBg = html.style.getPropertyValue('--bg');
    document.body.classList.add('theme-light');
    html.style.setProperty('--bg', '#ffffff');
    // A room is entered at its door, not wherever the last page left the scroll.
    window.scrollTo(0, 0);
    return () => {
      document.body.classList.remove('theme-light');
      if (prevBg) html.style.setProperty('--bg', prevBg);
      else html.style.removeProperty('--bg');
    };
  }, []);

  // The scene.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return undefined;

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
    const onScroll = () => {
      const d = driverRef.current;
      if (!d) return;
      const range = d.offsetHeight - window.innerHeight;
      scene.setScroll(range > 0 ? window.scrollY / range : 0);
    };
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { scene.resize(); onScroll(); });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') scene.blur();
      else if (e.key === 'ArrowRight') scene.next();
      else if (e.key === 'ArrowLeft') scene.prev();
      else if (e.key === '+' || e.key === '=') scene.zoomIn();
      else if (e.key === '-' || e.key === '_') scene.zoomOut();
      else if (e.key === '0') scene.zoomReset();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    onScroll();
    scene.resize();

    return () => {
      cancelAnimationFrame(raf);
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
    <>
      <nav className="nav is-scrolled" style={{ zIndex: 50 }}>
        <a href="./" data-cursor data-magnetic className="nav__brand">Ansh Chandpara</a>
        <div className="nav__links">
          <a href="?page=about#archive" data-cursor>← Lab</a>
          <a href="?page=about" data-cursor>About</a>
        </div>
      </nav>

      <main className={`rv${focused >= 0 ? ' is-focused' : ''}`}>
        {noWebGL ? (
          /* Honest degrade: the same sixteen drawings, as a grid, on white. */
          <div className="rv__grid">
            {items.map((it, i) => (
              <figure key={it.file} className="rv__cell">
                <img src={it.large} alt={`${item.title} ${nn(i)}`} loading="lazy" decoding="async" />
              </figure>
            ))}
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className="rv__canvas" aria-label={`${item.title}: ${count} drawings in a 3D space`} />
            {/* Tall, empty, and the reason scrolling walks the camera forward.
                Its height comes from the piece count so the walking pace is
                the same whether the room holds sixteen drawings or sixty. */}
            <div ref={driverRef} className="rv__driver" aria-hidden="true" style={{ height: `${runwayVhFor(items.length)}vh` }} />
          </>
        )}

        <div className="rv__ui">
          <div className="rv__top">
          <p className="eyebrow rv__eyebrow">
            {item.title} · {item.category} · {item.year}
            {loaded < count && !noWebGL && (
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
              {!noWebGL && (
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
              )}
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
      </main>

      <footer className="foot">
        <span>© 2026 Chandparaaa</span>
        <span>Creative Director · Title Designer · Filmmaker</span>
        <span>{CURRENT_LOCATION.city}, {CURRENT_LOCATION.country}</span>
      </footer>
    </>
  );
}
