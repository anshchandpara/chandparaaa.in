import { useLayoutEffect } from 'react';
import { CURRENT_LOCATION } from '../../lib/location';
import ReveriesRoom from './ReveriesRoom';
import Brand from '../Brand';

/**
 * Reveries as a page of its own — `?p=reveries` (see lab/pages.js). The room
 * itself is ReveriesRoom, which Home also mounts under the lab hero; this
 * wrapper gives it a nav, a footer, and a white page around it.
 */
export default function Reveries({ slug }) {
  // The room paints its own ground, but the page around it — footer, and the
  // rubber-band overscroll on macOS — needs the light tokens too. <html> gets
  // --bg from JS because lib/design.js `applyDesign()` sets it as an INLINE
  // style, which no stylesheet rule can beat. Restored exactly on unmount.
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

  return (
    <>
      <nav className="nav is-scrolled" style={{ zIndex: 50 }}>
        <Brand />
        <div className="nav__links">
          <a href="./" data-cursor>← Lab</a>
        </div>
      </nav>

      <main>
        <ReveriesRoom slug={slug} standalone />
      </main>

      <footer className="foot">
        <span>© 2026 Chandparaaa</span>
        <span>Artist · CG Generalist · Creative Director</span>
        <span>{CURRENT_LOCATION.city}, {CURRENT_LOCATION.country}</span>
      </footer>
    </>
  );
}
