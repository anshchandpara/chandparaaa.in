import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import './Loader.css';

/**
 * Intro loader: a counter (000→100) wipes a progress bar, then the overlay
 * slides up (yPercent -102, 0.9s linear). Calls onDone when fully dismissed.
 */
export default function Loader({ onDone }) {
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const [num, setNum] = useState('000');

  useEffect(() => {
    const start = performance.now();
    const dur = 1700;
    let raf;

    const tick = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3); // ease-out on the counter value only
      setNum(String(Math.round(e * 100)).padStart(3, '0'));
      if (barRef.current) barRef.current.style.inset = `0 ${100 - e * 100}% 0 0`;
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        dismiss();
      }
    };

    const dismiss = () => {
      const el = rootRef.current;
      if (!el) return onDone?.();
      gsap.to(el, { yPercent: -102, duration: 0.9, ease: 'none', onComplete: () => onDone?.() });
    };

    raf = requestAnimationFrame(tick);

    // Safety: never trap the user behind the loader.
    const safety = setTimeout(() => onDone?.(), 4200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="loader">
      <div className="loader__top">
        <span className="loader__brand">Chandparaaa</span>
        <span className="loader__tag">Portfolio — 2026</span>
      </div>
      <div className="loader__mid">
        <span className="loader__num">{num}</span>
        <span className="loader__role">Director · Title Designer</span>
      </div>
      <div className="loader__track">
        <div ref={barRef} className="loader__bar" />
      </div>
    </div>
  );
}
