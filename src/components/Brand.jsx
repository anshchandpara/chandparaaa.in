import { useState } from 'react';
import { randomWeight } from '../lib/weights';

const NAME = 'Ansh Chandpara';
const CHARS = NAME.split('');

/**
 * The nav wordmark. One span per letter so each can sit at its own random cut
 * on the display face's weight axis (see lib/weights.js); the cuts are drawn
 * once per mount, so the line is stable while a page is open and re-set on
 * the next. Shared by every nav that carries the name.
 */
export default function Brand() {
  const [weights] = useState(() => CHARS.map(randomWeight));
  return (
    <a href="./" data-cursor className="nav__brand" aria-label={NAME}>
      {CHARS.map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : (
          <span key={i} className="nav__brand-letter" style={{ '--wght': weights[i] }}>
            {ch}
          </span>
        )
      )}
    </a>
  );
}
