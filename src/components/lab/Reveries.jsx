import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getProject } from '../../lib/projectData';
import { projectEntry, mediaUrl } from '../../lib/mediaManifest';
import { CURRENT_LOCATION } from '../../lib/location';
import { createScene } from './reveriesScene';
import './Reveries.css';

const LARGE_RE = /\.large\.webp$/i;

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
    const files = projectEntry(slug).files.filter((f) => /\.webp$/i.test(f) && !LARGE_RE.test(f));
    return files.map((f) => ({
      file: f,
      src: mediaUrl(slug, f),
      large: mediaUrl(slug, f.replace(/\.webp$/i, '.large.webp')),
    }));
  }, [slug]);

  const canvasRef = useRef(null);
  const driverRef = useRef(null);
  const sceneRef = useRef(null);
  const [focused, setFocused] = useState(-1);
  const [loaded, setLoaded] = useState(0);
  const [noWebGL, setNoWebGL] = useState(false);

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
            {/* Tall, empty, and the reason scrolling walks the camera forward. */}
            <div ref={driverRef} className="rv__driver" aria-hidden="true" />
          </>
        )}

        <div className="rv__ui">
          <p className="eyebrow rv__eyebrow">
            {item.title} · {item.category} · {item.year}
            {loaded < count && !noWebGL && (
              <span className="rv__load" aria-live="polite"> · {loaded}/{count}</span>
            )}
          </p>
          {!noWebGL && (
            <p className="rv__hint" aria-hidden={focused >= 0}>Click a drawing to bring it forward · scroll to walk through</p>
          )}

          <div className="rv__focus" aria-live="polite">
            <span className="rv__index">{focused >= 0 ? `${nn(focused)} / ${String(count).padStart(2, '0')}` : ''}</span>
            <div className="rv__controls" hidden={focused < 0}>
              <button type="button" className="rv__btn" data-cursor onClick={() => sceneRef.current?.prev()} aria-label="Previous drawing">‹</button>
              <button type="button" className="rv__btn" data-cursor onClick={() => sceneRef.current?.next()} aria-label="Next drawing">›</button>
              <button type="button" className="rv__btn rv__btn--close" data-cursor onClick={() => sceneRef.current?.blur()} aria-label="Close">×</button>
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
