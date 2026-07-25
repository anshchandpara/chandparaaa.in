import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { addPanel, removePanel } from '../lib/glTicker';

const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime; uniform float uHover; uniform vec2 uMouse; uniform vec3 uColor; uniform vec2 uRes;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
  void main(){
    vec2 uv=vUv; uv.x*= (uRes.x/uRes.y);
    float v=fbm(uv*2.7 + vec2(0.0, uTime*0.05) + uHover*0.3);
    vec3 dark=uColor*0.10;
    vec3 col=mix(dark,uColor*1.06,smoothstep(0.18,0.92,v));
    col += uColor*uHover*0.20*smoothstep(0.4,1.0,v);
    float scan=0.94+0.06*sin(vUv.y*620.0 + uTime*1.4);
    col*=scan;
    float vig=smoothstep(1.25,0.25,length(vUv-0.5));
    col*=0.38+vig*0.74;
    gl_FragColor=vec4(col,1.0);
  }`;

/**
 * Animated noise/scanline panel tinted with a project accent — the fallback
 * for cards without imagery. Mirrors the design prototype's card shader.
 */
export default function CardCanvas({ color }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    } catch {
      return undefined; // WebGL unavailable — leave the accent background.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const col = new THREE.Color(color || '#b08b55');
    const uni = {
      uTime: { value: Math.random() * 10 },
      uHover: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
      uRes: { value: new THREE.Vector2(1, 1) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      renderer.setSize(r.width, r.height, false);
      uni.uRes.value.set(r.width, r.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const media = canvas.parentElement;
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      uni.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    };
    let target = 0;
    const onEnter = () => { target = 1; };
    const onLeave = () => { target = 0; };
    if (media) {
      media.addEventListener('mousemove', onMove);
      media.addEventListener('mouseenter', onEnter);
      media.addEventListener('mouseleave', onLeave);
    }

    let visible = true;
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 });
      io.observe(canvas);
    }

    const panel = {
      render(dt) {
        uni.uTime.value += dt;
        uni.uHover.value += (target - uni.uHover.value) * 0.08;
        if (visible) renderer.render(scene, cam);
      },
    };
    addPanel(panel);

    return () => {
      removePanel(panel);
      window.removeEventListener('resize', resize);
      if (media) {
        media.removeEventListener('mousemove', onMove);
        media.removeEventListener('mouseenter', onEnter);
        media.removeEventListener('mouseleave', onLeave);
      }
      if (io) io.disconnect();
      mat.dispose();
      renderer.dispose();
    };
  }, [color]);

  return <canvas ref={canvasRef} className="fcard__gl" />;
}
