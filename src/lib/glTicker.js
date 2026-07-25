/**
 * Shared requestAnimationFrame ticker for all WebGL panels (card + project
 * hero). One rAF loop renders every registered panel, instead of one loop
 * each. Panels are plain objects with a `render(dt)` method.
 */
const panels = new Set();
let raf = null;
let last = 0;

function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  panels.forEach((p) => p.render(dt));
}

export function addPanel(p) {
  panels.add(p);
  if (raf == null) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

export function removePanel(p) {
  panels.delete(p);
  if (panels.size === 0 && raf != null) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}
