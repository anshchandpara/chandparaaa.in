import WeightedText from './WeightedText';

/**
 * The nav wordmark — one random weight per letter, flipping on hover (see
 * WeightedText). Shared by every nav that carries the name. `wt-hover` on the
 * link makes the whole link the hover target, not just the glyph boxes.
 */
export default function Brand() {
  return (
    <a href="./" data-cursor className="nav__brand wt-hover">
      <WeightedText text="Ansh Chandpara" />
    </a>
  );
}
