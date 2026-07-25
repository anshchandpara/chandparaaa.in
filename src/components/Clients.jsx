import PlatformMarquee from './PlatformMarquee';
import './Clients.css';

const LAB_WORDS = ['Process', 'Studies', 'Sketches', 'R&D', 'Unfinished'];

/**
 * Platforms / keywords band. Work mode → the OTT platform logo marquee
 * (replaces the old text grid — same names, real logos, plus more). Lab mode →
 * the keyword grid (hairline separators via a 1px gap over --line).
 */
export default function Clients({ mode = 'work' }) {
  if (mode !== 'lab') return <PlatformMarquee />;

  return (
    <section className="clients" data-screen-label="Clients">
      <div className="clients__grid">
        {LAB_WORDS.map((label, i) => (
          <div key={label} className="clients__cell">
            <span className="clients__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="clients__label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
