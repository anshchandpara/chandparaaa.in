import { PLATFORMS } from '../lib/platforms';
import './PlatformMarquee.css';

/**
 * Full-bleed marquee of OTT platform logo cards — a slow, continuous
 * filmstrip. The track is rendered twice and translated -50% for a seamless
 * loop; the duplicate is aria-hidden. Tiles sit desaturated in the site's
 * palette and lift to full brand color on hover (the strip pauses so you can
 * look). `prefers-reduced-motion` freezes it via the global kill-switch.
 */
export default function PlatformMarquee() {
  const strip = (hidden) => (
    <div className="pmq__strip" aria-hidden={hidden || undefined}>
      {PLATFORMS.map((p) => (
        <img
          key={p.name}
          className="pmq__logo"
          src={p.src}
          alt={hidden ? '' : p.name}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
      ))}
    </div>
  );

  return (
    <section className="pmq" data-screen-label="Platforms" aria-label="Streaming platforms">
      <div className="pmq__track">
        {strip(false)}
        {strip(true)}
      </div>
    </section>
  );
}
