import { useEffect, useState } from 'react';
import { useMagnetic } from '../hooks/useMagnetic';
import './Nav.css';

const PILL_LINKS = [
  { href: './#work', label: 'Projects' },
  { href: '?page=about', label: 'About' },
];

export default function Nav({ mode, onMode }) {
  const [scrolled, setScrolled] = useState(false);
  const workRef = useMagnetic();
  const labRef = useMagnetic();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' is-scrolled' : ''}`} style={{ zIndex: 50 }}>
      <a href="./" data-cursor className="nav__brand">Ansh Chandpara</a>

      <div className="nav__right">
        <div className="nav__links">
          {PILL_LINKS.map((l) => (
            <a key={l.href} href={l.href} data-cursor>{l.label}</a>
          ))}
        </div>

        <div className="nav__toggle" role="group" aria-label="Work or Lab mode">
          <button
            ref={workRef}
            data-magnetic
            className={`nav__pill${mode === 'work' ? ' is-active' : ''}`}
            aria-pressed={mode === 'work'}
            onClick={() => onMode('work')}
          >
            Work
          </button>
          <button
            ref={labRef}
            data-magnetic
            className={`nav__pill${mode === 'lab' ? ' is-active' : ''}`}
            aria-pressed={mode === 'lab'}
            onClick={() => onMode('lab')}
          >
            Lab
          </button>
        </div>
      </div>
    </nav>
  );
}
