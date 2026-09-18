import WeightedText from './WeightedText';
import { rampWeights } from '../lib/weights';

const NAME = 'Ansh Chandpara';
// Ordered, not random (Ansh, 2026-09-18): heavy at the A, light at the last a,
// one even step per letter — and the hover flip reverses the ramp.
const RAMP = rampWeights(NAME.length);

/**
 * The nav wordmark — a weight ramp across the name, reversing on hover (see
 * WeightedText). Shared by every nav that carries the name. `wt-hover` on the
 * link makes the whole link the hover target, not just the glyph boxes.
 */
export default function Brand() {
  return (
    <a href="./" data-cursor className="nav__brand wt-hover">
      <WeightedText text={NAME} weights={RAMP} />
    </a>
  );
}
