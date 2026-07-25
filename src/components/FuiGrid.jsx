import { useEffect, useRef } from 'react';
import './FuiGrid.css';

/**
 * Site-wide FUI backdrop: a super-dim technical grid fixed behind all content
 * (first in the DOM, pointer-events none). A second, accent-tinted copy of the
 * grid is revealed through a radial mask that follows the cursor, so the grid
 * "glows" faintly around the pointer. Touch devices get the static grid only;
 * the glow parks off-screen. Coordinates are written as CSS vars from a
 * rAF-throttled mousemove — no layout work, compositor only.
 */
export default function FuiGrid() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return undefined;

    let raf = 0;
    let x = -999;
    let y = -999;

    const paint = () => {
      raf = 0;
      el.style.setProperty('--fui-x', `${x}px`);
      el.style.setProperty('--fui-y', `${y}px`);
    };
    const move = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const leave = () => {
      x = -999;
      y = -999;
      if (!raf) raf = requestAnimationFrame(paint);
    };

    window.addEventListener('mousemove', move, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      document.documentElement.removeEventListener('mouseleave', leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="fui" aria-hidden="true">
      <div className="fui__base" />
      <div className="fui__glow" />
    </div>
  );
}
