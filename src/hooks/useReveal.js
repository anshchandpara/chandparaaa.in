import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Generic scroll reveal for any [data-rv] descendants of the returned ref:
 * opacity 0→1 + y 16→0, 0.4s linear, triggered at ~top 90%.
 * Re-runs when `deps` change (e.g. mode swaps that change the subtree).
 */
export function useReveal(deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = gsap.utils.toArray('[data-rv]', root);
    if (!els.length) return undefined;

    if (reduced) {
      gsap.set(els, { opacity: 1, y: 0 });
      return undefined;
    }

    gsap.set(els, { opacity: 0, y: 16 });
    const triggers = els.map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.4, ease: 'none' }),
      })
    );
    ScrollTrigger.refresh();

    return () => triggers.forEach((t) => t.kill());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
