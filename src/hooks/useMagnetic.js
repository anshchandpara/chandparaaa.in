import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Magnetic hover: element translates toward the cursor (factor 0.4) on
 * mousemove (0.22s linear), returns to 0 on leave (0.32s linear). No bounce.
 * Disabled on touch / coarse pointers.
 */
export function useMagnetic(strength = 0.4) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * strength;
      const y = (e.clientY - r.top - r.height / 2) * strength;
      gsap.to(el, { x, y, duration: 0.22, ease: 'none' });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.32, ease: 'none' });

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      gsap.killTweensOf(el);
    };
  }, [strength]);

  return ref;
}
