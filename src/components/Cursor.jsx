import { useEffect, useRef } from 'react';
import './Cursor.css';

/**
 * Custom cursor: a dot that tracks instantly + an inverted-triangle outline
 * that trails via rAF lerp (factor 0.3, snappy). On hover over [data-cursor]
 * the triangle grows and tints to the accent. Hidden on touch devices.
 */
export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.body.classList.add('cursor-on');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf;

    const move = (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px)`;
    };
    const loop = () => {
      rx += (mx - rx) * 0.3;
      ry += (my - ry) * 0.3;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      raf = requestAnimationFrame(loop);
    };

    const grow = (e) => { if (e.target.closest('[data-cursor]')) ring.classList.add('is-grow'); };
    const reset = (e) => { if (e.target.closest('[data-cursor]')) ring.classList.remove('is-grow'); };

    window.addEventListener('mousemove', move);
    document.addEventListener('mouseover', grow);
    document.addEventListener('mouseout', reset);
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseover', grow);
      document.removeEventListener('mouseout', reset);
      document.body.classList.remove('cursor-on');
    };
  }, []);

  return (
    <>
      <svg ref={ringRef} id="cursor-ring" viewBox="0 0 100 100" aria-hidden="true">
        <polygon points="12,30 88,30 50,84" vectorEffect="non-scaling-stroke" />
      </svg>
      <div ref={dotRef} id="cursor-dot" />
    </>
  );
}
