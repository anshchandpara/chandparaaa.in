import * as THREE from 'three';
import gsap from 'gsap';
import { addPanel, removePanel } from '../../lib/glTicker';

/**
 * Reveries — sixteen ink cut-outs floating in a white room.
 *
 * Pure three.js; no React in here. `createScene(canvas, items, opts)` owns the
 * renderer and returns a small controller the React shell drives. Follows the
 * house pattern from ProjectHeroCanvas / CardCanvas: one WebGLRenderer on a
 * canvas ref, ticks from the shared glTicker loop, everything disposed on
 * teardown.
 *
 * Why three and not CSS 3D: the artwork is delicate line-work. Rotated in
 * perspective without anisotropic filtering and mipmaps it shimmers; three
 * gives both for free. That is the whole reason a WebGL context is spent here.
 *
 * Every number a person might want to change lives in TUNE, so Ansh's notes
 * ("slower", "closer", "more fog") translate to one edit.
 */
export const TUNE = {
  fov: 40,
  camZ: 8,           // where the camera starts
  travel: 12,        // MINIMUM walk (−z) for a full scroll; grows with the count — see travelFor()
  vhPerUnit: 25,     // scroll runway: viewport-heights of page per unit of walk
  parallax: 0.35,    // camera offset (units) with the pointer at the viewport edge
  parallaxLerp: 0.06,

  spread: 0.9,       // z between successive pieces — the depth of the cloud
  radius: [1.8, 3.2],// helix radius, jittered per piece
  tilt: [12, 6],     // max resting tilt, degrees, around y / x
  longEdge: 2.0,     // plane size: long edge in units, short edge follows the aspect

  driftY: 0.08,      // bob amplitude
  driftRot: 2.5,     // wobble amplitude, degrees
  driftPeriod: [6, 10],

  fog: [6, 16],      // near / far — far pieces dissolve to white

  focusDist: 3.2,    // how far in front of the camera a focused piece sits
  focusFill: 0.78,   // fraction of viewport height it fills
  focusDur: 0.9,
  recedeOpacity: 0.12,
  recedeZ: 1.5,      // how far the others fall back while one is focused

  seed: 1618,        // arrangement is deterministic — the same room every visit

  // Direct manipulation. Drag moves a piece in the plane facing the camera;
  // Shift/Alt-drag or right-drag turns it. A moving piece leans into its
  // motion a little (`lean`), which is what makes it feel held, not slid.
  turnSpeed: 0.55,   // degrees of rotation per pixel of drag
  lean: 0.045,       // tilt per px/frame of drag velocity (radians-ish, small)
  leanMax: 14,       // degrees — the lean never exceeds this
  leanDecay: 0.12,   // how fast the lean settles once released
  resetDur: 1.1,

  // Zoom on a focused piece. Wheel and pinch are continuous; buttons, keys
  // and double-click step. The zoom tier (3072px) loads past zoomTierAt.
  zoomMax: 4,
  zoomStep: 1.6,      // per button / key press
  zoomDouble: 2.5,    // double-click toggles 1 ↔ this
  zoomWheel: 0.0015,  // zoom factor per wheel pixel
  zoomTierAt: 1.5,
};

/**
 * How far a full scroll walks the camera, for a room of `count` pieces. The
 * helix is `spread` deep per piece, so the walk ends just short of the last
 * one; sixteen pieces gave 12 units and that pace is kept for any count.
 */
export function travelFor(count) {
  return Math.max(TUNE.travel, (count - 1) * TUNE.spread - 1.5);
}
/** Runway height, in vh, that scrolls that far at the same pace as sixteen did. */
export function runwayVhFor(count) {
  return Math.round(100 + travelFor(count) * TUNE.vhPerUnit);
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const deg = (d) => (d * Math.PI) / 180;

/** mulberry32 — small, seeded, good enough for placing sixteen things. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, [lo, hi]) => lo + r() * (hi - lo);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{src:string, large:string}>} items
 * @param {{ reducedMotion?: boolean, onHover?: (i:number)=>void,
 *           onFocus?: (i:number)=>void, onLoad?: (loaded:number,total:number)=>void }} opts
 */
export function createScene(canvas, items, opts = {}) {
  const { reducedMotion = false, onHover, onFocus, onLoad, onDisturb, onZoom } = opts;
  const travel = travelFor(items.length);

  // Throws when WebGL is unavailable — the caller catches and falls back.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // The ground is driven by the shell: white when the room is pinned, the
  // site's dark when it is sliding in over the hero or out to the footer.
  // Clear colour and fog move together, so the drawings dissolve INTO the
  // ground whatever shade it is — black ink emerges out of the dark as the
  // room brightens, which is the whole transition.
  const GROUND_DARK = new THREE.Color(0x0a0a0a);
  const GROUND_LIGHT = new THREE.Color(0xffffff);
  const ground = GROUND_LIGHT.clone();
  let groundT = 1; // 0 dark … 1 white; pieces fade with it (see the frame loop)
  renderer.setClearColor(ground, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(ground.clone(), TUNE.fog[0], TUNE.fog[1]);

  const camera = new THREE.PerspectiveCamera(TUNE.fov, 1, 0.1, 60);
  camera.position.set(0, 0, TUNE.camZ);

  // ---- pieces --------------------------------------------------------------
  const rand = rng(TUNE.seed);
  const loader = new THREE.TextureLoader();
  // Placement is a seeded shuffle of the file order. Without it the room reads
  // in the order the files were added — the first series at the front, every
  // later addition behind it — and anything that arrived as a batch clusters.
  // Shuffling the SLOT, not the item, keeps file numbers and the caption stable.
  const slotOf = items.map((_, i) => i);
  for (let i = slotOf.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [slotOf[i], slotOf[j]] = [slotOf[j], slotOf[i]];
  }
  const pieces = items.map((item, i) => {
    const slot = slotOf[i];
    const angle = slot * GOLDEN + rand() * 0.6;
    const radius = between(rand, TUNE.radius);
    const home = {
      pos: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7, -slot * TUNE.spread),
      rot: new THREE.Euler(
        deg((rand() * 2 - 1) * TUNE.tilt[1]),
        deg((rand() * 2 - 1) * TUNE.tilt[0]),
        0
      ),
    };
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,           // fades up when its texture lands
      side: THREE.DoubleSide,
      depthWrite: false,    // soft alpha edges must not punch holes in what is behind
      alphaTest: 0.02,
      fog: true,
    });
    // Placeholder geometry; replaced with the aspect-true plane on load.
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.position.copy(home.pos);
    mesh.rotation.copy(home.rot);
    mesh.userData.index = i;
    scene.add(mesh);

    return {
      i, item, mesh, material, home,
      // The seeded slot, kept apart from `home`: manipulation rewrites home
      // (a piece keeps drifting from wherever it was left); reset restores this.
      origin: { pos: home.pos.clone(), rot: home.rot.clone() },
      held: false,          // true while the pointer has it
      lean: new THREE.Vector2(), // transient tilt from drag velocity
      loaded: 0,            // 0 → 1 as the base texture arrives
      dim: 1,               // 1 normally, TUNE.recedeOpacity while another is focused
      recede: 0,            // extra −z while another is focused
      phase: rand() * Math.PI * 2,
      period: between(rand, TUNE.driftPeriod),
      focusing: false,      // true while this piece is driven by a focus/blur tween
      large: null,          // hi-res texture once loaded
      largeLoading: false,
      zoomTex: null,        // 3072px tier, held only while this piece is focused and zoomed
      zoomLoading: false,
    };
  });

  let loadedCount = 0;
  const prepTexture = (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  };

  pieces.forEach((p) => {
    loader.load(
      p.item.src,
      (tex) => {
        if (disposed) { tex.dispose(); return; }
        prepTexture(tex);
        const { width, height } = tex.image;
        const portrait = height >= width;
        const long = TUNE.longEdge;
        const w = portrait ? long * (width / height) : long;
        const h = portrait ? long : long * (height / width);
        p.mesh.geometry.dispose();
        p.mesh.geometry = new THREE.PlaneGeometry(w, h);
        p.aspect = width / height;
        p.material.map = tex;
        p.material.needsUpdate = true;
        loadedCount += 1;
        onLoad?.(loadedCount, pieces.length);
        gsap.to(p, { loaded: 1, duration: reducedMotion ? 0 : 0.8, ease: 'none' });
      },
      undefined,
      () => { loadedCount += 1; onLoad?.(loadedCount, pieces.length); }
    );
  });

  // ---- camera state --------------------------------------------------------
  const pointer = { x: 0, y: 0 };      // −1..1, from the shell
  const par = { x: 0, y: 0 };          // lerped parallax
  let scrollT = 0;                     // 0..1, from the shell
  let frozen = null;                   // camera pose held while a piece is focused
  const lookTarget = new THREE.Vector3();

  let camZ = TUNE.camZ;
  function placeCamera() {
    if (frozen) return;
    const k = reducedMotion ? 0 : TUNE.parallax;
    par.x += (pointer.x * k - par.x) * TUNE.parallaxLerp;
    par.y += (pointer.y * k - par.y) * TUNE.parallaxLerp;
    // Lerp the travel too: scroll while a piece is focused is banked, not
    // applied, and this is what stops the camera snapping when it is released.
    const zTarget = TUNE.camZ - easeInOut(scrollT) * travel;
    camZ += (zTarget - camZ) * (reducedMotion ? 1 : 0.08);
    const z = camZ;
    camera.position.set(par.x, par.y, z);
    // Look at a point ahead on the axis, not straight down it, so the offset
    // reads as a small turn of the head — the "window" feeling.
    lookTarget.set(par.x * 0.4, par.y * 0.4, z - 10);
    camera.lookAt(lookTarget);
  }

  // ---- hover / focus -------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(2, 2); // off-screen until the pointer moves
  let hovered = -1;
  let focused = -1;

  /** Index of the piece under the pointer, or −1. */
  function pick() {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pieces.filter((p) => p.loaded > 0.5).map((p) => p.mesh), false);
    // Nearest hit whose texel is actually inked — a click in a transparent
    // region of a nearer piece should fall through to what is behind it.
    for (const hit of hits) {
      const p = pieces[hit.object.userData.index];
      if (hitIsInk(p, hit.uv)) return p.i;
    }
    return -1;
  }
  function updateHover() {
    setHover(focused >= 0 ? -1 : pick());
  }
  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    onHover?.(i);
  }

  // Sample the texture's alpha at the hit UV. Cached per piece on first use.
  function hitIsInk(p, uv) {
    if (!uv || !p.material.map) return true;
    if (!p.alphaSampler) p.alphaSampler = makeAlphaSampler(p.material.map.image);
    return p.alphaSampler(uv.x, 1 - uv.y) > 0.08;
  }
  function makeAlphaSampler(img) {
    const size = 128; // coarse is fine — this decides hit-testing, not rendering
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    return (u, v) => {
      const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)));
      const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
      return data[(y * size + x) * 4 + 3] / 255;
    };
  }

  function fitScale(p) {
    // Fill `focusFill` of the viewport height at focusDist, but never wider than 92%.
    const visH = 2 * TUNE.focusDist * Math.tan(deg(camera.fov / 2));
    const visW = visH * camera.aspect;
    const geo = p.mesh.geometry.parameters;
    const byH = (TUNE.focusFill * visH) / geo.height;
    const byW = (0.92 * visW) / geo.width;
    return Math.min(byH, byW);
  }

  const fwd = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();
  let zoom = 1; // on the focused piece only; 1 = the fitted size
  function focus(i) {
    if (i < 0 || i >= pieces.length || i === focused) return;
    const wasFocused = focused;
    if (wasFocused >= 0) dropZoomTexture(pieces[wasFocused]);
    zoom = 1; onZoom?.(1);
    focused = i;
    setHover(-1);
    onFocus?.(i);
    if (!frozen) frozen = camera.position.clone();

    const dur = reducedMotion ? 0 : TUNE.focusDur;
    const p = pieces[i];

    // Where it goes: straight ahead of the camera, facing it.
    camera.getWorldDirection(fwd);
    const target = camera.position.clone().add(fwd.multiplyScalar(TUNE.focusDist));
    // Rotation that faces the camera: borrow lookAt on a throwaway object.
    const probe = new THREE.Object3D();
    probe.position.copy(target);
    probe.lookAt(camera.position);
    tmpEuler.copy(probe.rotation);

    p.focusing = true;
    gsap.killTweensOf([p.mesh.position, p.mesh.rotation, p.mesh.scale]);
    gsap.to(p.mesh.position, { x: target.x, y: target.y, z: target.z, duration: dur, ease: 'power2.inOut' });
    gsap.to(p.mesh.rotation, { x: tmpEuler.x, y: tmpEuler.y, z: tmpEuler.z, duration: dur, ease: 'power2.inOut' });
    const s = fitScale(p);
    gsap.to(p.mesh.scale, { x: s, y: s, z: 1, duration: dur, ease: 'power2.inOut' });
    gsap.to(p, { dim: 1, recede: 0, duration: dur, ease: 'none' });
    p.mesh.renderOrder = 10; // drawn last — on top of anything it overlaps

    // Everyone else recedes into the fog. The previously focused piece goes home first.
    pieces.forEach((q) => {
      if (q.i === i) return;
      if (q.i === wasFocused) sendHome(q, dur);
      gsap.to(q, { dim: TUNE.recedeOpacity, recede: -TUNE.recedeZ, duration: dur, ease: 'none' });
    });

    loadLarge(p);
  }

  function sendHome(p, dur) {
    p.focusing = true;
    gsap.killTweensOf([p.mesh.position, p.mesh.rotation, p.mesh.scale]);
    gsap.to(p.mesh.position, { x: p.home.pos.x, y: p.home.pos.y, z: p.home.pos.z, duration: dur, ease: 'power2.inOut' });
    gsap.to(p.mesh.rotation, { x: p.home.rot.x, y: p.home.rot.y, z: p.home.rot.z, duration: dur, ease: 'power2.inOut',
      onComplete: () => { p.focusing = false; p.mesh.renderOrder = 0; } });
    gsap.to(p.mesh.scale, { x: 1, y: 1, z: 1, duration: dur, ease: 'power2.inOut' });
  }

  function blur() {
    if (focused < 0) return;
    const p = pieces[focused];
    focused = -1;
    onFocus?.(-1);
    dropZoomTexture(p);
    zoom = 1; onZoom?.(1);
    const dur = reducedMotion ? 0 : TUNE.focusDur;
    sendHome(p, dur);
    pieces.forEach((q) => gsap.to(q, { dim: 1, recede: 0, duration: dur, ease: 'none' }));
    // Release the camera once the piece is clear of it.
    gsap.delayedCall(dur * 0.5, () => { frozen = null; });
  }

  /** Every piece back to its seeded slot. The room as it was on arrival. */
  function reset() {
    if (focused >= 0) blur();
    const dur = reducedMotion ? 0 : TUNE.resetDur;
    pieces.forEach((p) => {
      if (p.held) return;
      p.focusing = true;
      gsap.killTweensOf([p.mesh.position, p.mesh.rotation, p.mesh.scale]);
      p.home.pos.copy(p.origin.pos);
      p.home.rot.copy(p.origin.rot);
      p.lean.set(0, 0);
      gsap.to(p.mesh.position, { x: p.origin.pos.x, y: p.origin.pos.y, z: p.origin.pos.z, duration: dur, ease: 'power2.inOut' });
      gsap.to(p.mesh.rotation, { x: p.origin.rot.x, y: p.origin.rot.y, z: p.origin.rot.z, duration: dur, ease: 'power2.inOut',
        onComplete: () => { p.focusing = false; } });
      gsap.to(p.mesh.scale, { x: 1, y: 1, z: 1, duration: dur, ease: 'power2.inOut' });
    });
  }

  function loadLarge(p) {
    if (p.large || p.largeLoading || !p.item.large) return;
    p.largeLoading = true;
    loader.load(p.item.large, (tex) => {
      p.largeLoading = false;
      if (disposed) { tex.dispose(); return; }
      p.large = prepTexture(tex);
      // Only swap if it is still the one being looked at — otherwise keep it
      // warm for next time.
      if (focused === p.i) { p.material.map = p.large; p.material.needsUpdate = true; }
    }, undefined, () => { p.largeLoading = false; });
  }

  // ---- zoom on the focused piece ------------------------------------------
  /**
   * Set the zoom, scaling ABOUT a point on the piece so what is under the
   * cursor (or between the fingers) stays put. `about` is an NDC vector; with
   * none, the piece scales about its own centre.
   */
  const zoomHit = new THREE.Vector3();
  const zoomPlane = new THREE.Plane();
  function setZoom(next, about = null, animate = false) {
    if (focused < 0) return;
    const p = pieces[focused];
    const z = Math.min(TUNE.zoomMax, Math.max(1, next));
    if (Math.abs(z - zoom) < 1e-4) return;
    const ratio = z / zoom;
    zoom = z;
    gsap.killTweensOf(p.mesh.scale);
    const s = fitScale(p) * zoom;
    // Keep the anchor point fixed: move the centre away from it by the ratio.
    let target = p.mesh.position.clone();
    if (about) {
      camera.getWorldDirection(camDir);
      zoomPlane.setFromNormalAndCoplanarPoint(camDir, p.mesh.position);
      raycaster.setFromCamera(about, camera);
      if (raycaster.ray.intersectPlane(zoomPlane, zoomHit)) {
        target = zoomHit.clone().add(p.mesh.position.clone().sub(zoomHit).multiplyScalar(ratio));
      }
    }
    if (animate && !reducedMotion) {
      gsap.killTweensOf(p.mesh.position);
      gsap.to(p.mesh.scale, { x: s, y: s, duration: 0.35, ease: 'power2.out' });
      gsap.to(p.mesh.position, { x: target.x, y: target.y, z: target.z, duration: 0.35, ease: 'power2.out' });
    } else {
      p.mesh.scale.set(s, s, 1);
      p.mesh.position.copy(target);
    }
    onZoom?.(zoom);
    if (zoom >= TUNE.zoomTierAt) loadZoomTier(p);
  }
  function zoomIn(about)  { setZoom(zoom * TUNE.zoomStep, about, true); }
  function zoomOut(about) { setZoom(zoom / TUNE.zoomStep, about, true); }
  function zoomReset()    { setZoom(1, null, true); }
  function zoomToggle(about) { setZoom(zoom > 1.05 ? 1 : TUNE.zoomDouble, about, true); }

  function loadZoomTier(p) {
    if (p.zoomTex || p.zoomLoading || !p.item.zoom) return;
    p.zoomLoading = true;
    loader.load(p.item.zoom, (tex) => {
      p.zoomLoading = false;
      if (disposed || focused !== p.i) { tex.dispose(); return; }
      p.zoomTex = prepTexture(tex);
      p.material.map = p.zoomTex; p.material.needsUpdate = true;
    }, undefined, () => { p.zoomLoading = false; });
  }
  // A 3072px texture is ~25 MB on the GPU; they are never kept past the focus
  // that asked for them. The browser cache makes the next load cheap.
  function dropZoomTexture(p) {
    if (!p.zoomTex) return;
    if (p.material.map === p.zoomTex) { p.material.map = p.large || p.material.map; p.material.needsUpdate = true; }
    p.zoomTex.dispose(); p.zoomTex = null;
  }

  // ---- pointer on the canvas: tap, drag-move, drag-turn, touch-walk --------
  //
  // One press can end three ways. A release within 8px is a TAP: focus or
  // blur. Movement on a piece is a DRAG: it moves the piece in the plane that
  // faces the camera at its depth (so it follows the cursor exactly, at any
  // distance), or turns it when Shift/Alt is held or the right button is used.
  // On touch, movement on EMPTY space walks the camera — the canvas is
  // `touch-action: none` so a finger on a piece can never scroll the page
  // instead, and this is what gives scrolling back.
  let down = null;      // the press, for tap detection
  let held = null;      // { p, mode, plane, offset, last, moved }
  let walk = null;      // touch drag on empty space → scroll
  const active = new Map(); // pointerId → {x,y}; two of them while focused = a pinch
  let pinch = null;     // { dist, zoom }
  let lastTapAt = 0;
  const dragPlane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const qTmp = new THREE.Quaternion();
  const axisX = new THREE.Vector3();
  const AXIS_Y = new THREE.Vector3(0, 1, 0);

  const onPointerDown = (e) => {
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (active.size === 2 && focused >= 0) {
      // Second finger: this is a pinch, not a drag. Let go of any held piece.
      const [a, b] = [...active.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      if (held) { held.p.held = false; if (focused === held.p.i) held.p.focusing = true; held = null; }
      down = null; walk = null;
      return;
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    setNdcFromEvent(e);
    const i = pick();
    if (i >= 0) {
      const p = pieces[i];
      const rotate = e.shiftKey || e.altKey || e.button === 2;
      // Plane through the piece, facing the camera — the surface it slides on.
      camera.getWorldDirection(camDir);
      dragPlane.setFromNormalAndCoplanarPoint(camDir, p.mesh.position);
      raycaster.setFromCamera(ndc, camera);
      raycaster.ray.intersectPlane(dragPlane, hit);
      held = {
        p, rotate,
        offset: hit.clone().sub(p.mesh.position), // so it never jumps to the cursor
        // `start` is the pose at grab (drift included, so nothing jumps);
        // `delta` is only what the hand has turned it since. Display is
        // delta·start (+ lean); on release home becomes delta·home — so a
        // pure move leaves the orientation exactly as it was, and a turn
        // never bakes the drift phase into it.
        start: p.mesh.quaternion.clone(),
        delta: new THREE.Quaternion(),
        last: { x: e.clientX, y: e.clientY },
        moved: false,
      };
      gsap.killTweensOf([p.mesh.position, p.mesh.rotation, p.mesh.scale]);
      p.held = true;
      p.focusing = false;
      p.mesh.renderOrder = focused === p.i ? 10 : 5; // above its neighbours while held
      try { canvas.setPointerCapture(e.pointerId); } catch { /* not all pointers capture */ }
    } else if (e.pointerType === 'touch') {
      walk = { y: e.clientY };
    }
  };

  const onPointerMove = (e) => {
    setNdcFromEvent(e);
    if (active.has(e.pointerId)) active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && active.size >= 2) {
      const [a, b] = [...active.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = canvas.getBoundingClientRect();
      const mid = new THREE.Vector2((((a.x + b.x) / 2 - r.left) / r.width) * 2 - 1, -((((a.y + b.y) / 2 - r.top) / r.height) * 2 - 1));
      setZoom(pinch.zoom * (dist / pinch.dist), mid);
      return;
    }
    if (walk) {
      const dy = e.clientY - walk.y;
      walk.y = e.clientY;
      window.scrollBy(0, -dy);
      return;
    }
    if (!held) return;
    const { p } = held;
    const dx = e.clientX - held.last.x;
    const dy = e.clientY - held.last.y;
    held.last = { x: e.clientX, y: e.clientY };
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) held.moved = true;
    if (!held.moved) return;

    if (held.rotate) {
      // Turn about the world up axis for sideways drag, and about the camera's
      // right axis for vertical drag — the two turns a hand would make.
      axisX.set(1, 0, 0).applyQuaternion(camera.quaternion);
      qTmp.setFromAxisAngle(AXIS_Y, deg(dx * TUNE.turnSpeed));
      held.delta.premultiply(qTmp);
      qTmp.setFromAxisAngle(axisX, deg(dy * TUNE.turnSpeed));
      held.delta.premultiply(qTmp);
    } else {
      camera.getWorldDirection(camDir);
      dragPlane.setFromNormalAndCoplanarPoint(camDir, p.mesh.position);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(dragPlane, hit)) {
        p.mesh.position.copy(hit.sub(held.offset));
      }
      if (!reducedMotion) {
        // Lean into the motion. Decays in the frame loop.
        p.lean.x = Math.max(-1, Math.min(1, p.lean.x + dy * TUNE.lean * 0.1));
        p.lean.y = Math.max(-1, Math.min(1, p.lean.y + dx * TUNE.lean * 0.1));
      }
    }
  };

  const onPointerUp = (e) => {
    active.delete(e.pointerId);
    if (pinch) { if (active.size < 2) pinch = null; down = null; return; }
    walk = null;
    if (held) {
      const { p, moved, start, delta, rotate } = held;
      held = null;
      p.held = false;
      p.mesh.quaternion.copy(start).premultiply(delta); // drop the lean; keep the turn
      if (focused === p.i) {
        // A focused piece is being examined, not rehomed: blur still returns
        // it to its slot in the cloud. The focus owns it again — without this
        // the drift loop takes it back the moment it is released.
        p.focusing = true;
      } else {
        // Wherever it was left is its new home: drift resumes from here, and
        // focus/blur tween to and from here.
        // Only what the hand changed becomes home: a move rehomes position, a
        // turn rehomes orientation. Copying the other would bake in the drift
        // phase the piece happened to be at when grabbed.
        if (rotate) {
          qTmp.setFromEuler(p.home.rot).premultiply(delta);
          p.home.rot.setFromQuaternion(qTmp);
        } else {
          p.home.pos.copy(p.mesh.position);
        }
        p.mesh.renderOrder = 0;
        if (moved) onDisturb?.();
      }
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (moved) { down = null; return; } // a drag is not a tap
    }
    if (!down) return;
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (dist > 8 || !quick) return;
    // The second tap of a double-click is not a tap of its own — dblclick
    // handles that pair as a zoom.
    const now = performance.now();
    const isSecondTap = now - lastTapAt < 320;
    lastTapAt = now;
    if (isSecondTap && focused >= 0) return;
    // Re-raycast at the release point so touch (no hover) works too.
    setNdcFromEvent(e);
    const i = pick();
    if (focused >= 0) {
      // Another piece: switch to it. The same piece, or empty space: close.
      if (i >= 0 && i !== focused) focus(i);
      else blur();
    } else if (i >= 0) {
      focus(i);
    }
  };
  const onPointerLeave = () => { if (!held) { ndc.set(2, 2); setHover(-1); } };
  // While a piece is forward the wheel zooms it instead of scrolling the page
  // (scroll is banked during focus anyway, so nothing is lost).
  const onWheel = (e) => {
    if (focused < 0) return;
    e.preventDefault();
    setNdcFromEvent(e);
    setZoom(zoom * Math.exp(-e.deltaY * TUNE.zoomWheel), ndc.clone());
  };
  // Double-click zooms in on the point, or back out. It lands after the two
  // taps that focused the piece, so it reads as "double-click a drawing to
  // look closer".
  const onDblClick = (e) => {
    if (focused < 0) return;
    setNdcFromEvent(e);
    zoomToggle(ndc.clone());
  };
  // Right-drag turns a piece; the context menu would eat it.
  const onContextMenu = (e) => { if (held || pick() >= 0) e.preventDefault(); };
  function setNdcFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);

  // ---- frame ---------------------------------------------------------------
  let t = 0;
  let disposed = false;
  let visible = true; // the shell gates this on the stage being on screen
  const panel = {
    render(dt) {
      if (!visible) return;
      t += dt;
      placeCamera();
      const amp = reducedMotion ? 0 : 1;
      pieces.forEach((p) => {
        // Opacity follows the ground ramp as well as load and focus state.
        // Without this the opaque plates — white paper, a coloured card —
        // lit up as bright rectangles against the dark before the ink pieces
        // (which are black on dark and so naturally invisible) had emerged.
        // Squared, so nothing shows while the ground is still dark grey; the
        // whole room switches on together as it brightens.
        p.material.opacity = p.loaded * p.dim * groundT * groundT;
        // The lean settles whether held or not; while held it is fed by the drag.
        p.lean.multiplyScalar(1 - TUNE.leanDecay);
        if (p.held) {
          // The pointer owns position and turn. Display = base orientation
          // (held.q) + lean; the base itself is never read back from the mesh.
          p.mesh.quaternion.copy(held.start).premultiply(held.delta);
          if (!held.rotate) {
            p.mesh.rotation.x += p.lean.x * deg(TUNE.leanMax);
            p.mesh.rotation.y += p.lean.y * deg(TUNE.leanMax);
          }
          return;
        }
        if (p.focusing) return; // a tween owns the transform
        const w = (t / p.period + p.phase) * Math.PI * 2;
        p.mesh.position.set(
          p.home.pos.x,
          p.home.pos.y + Math.sin(w) * TUNE.driftY * amp,
          p.home.pos.z + p.recede
        );
        p.mesh.rotation.set(
          p.home.rot.x + Math.sin(w * 0.7) * deg(TUNE.driftRot) * amp * 0.5 + p.lean.x * deg(TUNE.leanMax),
          p.home.rot.y + Math.cos(w) * deg(TUNE.driftRot) * amp + p.lean.y * deg(TUNE.leanMax),
          p.home.rot.z
        );
      });
      if (ndc.x <= 1 && ndc.x >= -1) updateHover();
      renderer.render(scene, camera);
    },
  };

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (focused >= 0) {
      const p = pieces[focused];
      const s = fitScale(p) * zoom;
      gsap.to(p.mesh.scale, { x: s, y: s, duration: 0.3, ease: 'none' });
    }
  }
  resize();
  addPanel(panel);

  function dispose() {
    disposed = true;
    removePanel(panel);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('dblclick', onDblClick);
    pieces.forEach((p) => {
      gsap.killTweensOf([p, p.mesh.position, p.mesh.rotation, p.mesh.scale]);
      p.mesh.geometry.dispose();
      p.material.map?.dispose();
      p.large?.dispose();
      p.zoomTex?.dispose();
      p.material.dispose();
      scene.remove(p.mesh);
    });
    renderer.dispose();
  }

  return {
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setScroll(v) { scrollT = Math.min(1, Math.max(0, v)); },
    focus,
    blur,
    next() { focus(focused < 0 ? 0 : (focused + 1) % pieces.length); },
    prev() { focus(focused < 0 ? pieces.length - 1 : (focused - 1 + pieces.length) % pieces.length); },
    get focused() { return focused; },
    reset,
    /** True when any piece has been moved or turned from its seeded slot. */
    get disturbed() {
      return pieces.some((p) => p.home.pos.distanceTo(p.origin.pos) > 0.01
        || Math.abs(p.home.rot.x - p.origin.rot.x) + Math.abs(p.home.rot.y - p.origin.rot.y) + Math.abs(p.home.rot.z - p.origin.rot.z) > 0.01);
    },
    get count() { return pieces.length; },
    get travel() { return travel; },
    get zoom() { return zoom; },
    setVisible(v) { visible = !!v; },
    /** 0 = the site's dark, 1 = white. Clear colour and fog follow. */
    setGround(t) {
      groundT = Math.min(1, Math.max(0, t));
      ground.lerpColors(GROUND_DARK, GROUND_LIGHT, groundT);
      renderer.setClearColor(ground, 1);
      scene.fog.color.copy(ground);
    },
    zoomIn: () => zoomIn(null),
    zoomOut: () => zoomOut(null),
    zoomReset,
    resize,
    dispose,
    // exposed for verification only
    _debug: { scene, camera, pieces, renderer },
  };
}
