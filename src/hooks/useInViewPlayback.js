import { useEffect } from 'react';

/**
 * Gallery loops play only while on screen. A page like Dico or Lootere
 * carries eight to ten autoplay loops; letting them all run at once is what a
 * phone chokes on (iOS caps concurrent decoders, Android drops frames), and
 * on desktop it burns CPU on frames nobody sees. One IntersectionObserver for
 * every `video` under `root`, re-armed whenever the gallery changes.
 */
export function useInViewPlayback(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const videos = Array.from(root.querySelectorAll('video'));
    if (!videos.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) v.play?.().catch(() => {});
          else v.pause?.();
        });
      },
      { rootMargin: '25% 0px' } // start a beat before it scrolls in
    );
    videos.forEach((v) => io.observe(v));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
