import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { addPanel, removePanel } from '../lib/glTicker';

const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
const FRAG = `
  precision highp float;
  varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform vec2 uRes;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
  void main(){
    vec2 uv=vUv; uv.x*=(uRes.x/uRes.y);
    float n=fbm(uv*2.4 + vec2(uTime*0.03, uTime*0.05));
    float n2=fbm(uv*4.6 - vec2(uTime*0.04,0.0));
    float v=mix(n,n2,0.45);
    vec3 dark=uColor*0.09;
    vec3 col=mix(dark,uColor*1.05,smoothstep(0.2,0.92,v));
    float scan=0.94+0.06*sin(vUv.y*1000.0+uTime*1.4);
    col*=scan;
    float vig=smoothstep(1.25,0.2,length(vUv-0.5)); col*=0.4+vig*0.7;
    col += (hash(vUv*(uTime+1.0))-0.5)*0.04;
    gl_FragColor=vec4(col,1.0);
  }`;

/** Full-bleed shader panel for the project hero when no image is present. */
export default function ProjectHeroCanvas({ color }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    } catch {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const col = new THREE.Color(color || '#b08b55');
    const uni = {
      uTime: { value: Math.random() * 10 },
      uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
      uRes: { value: new THREE.Vector2(1, 1) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      renderer.setSize(r.width, r.height, false);
      uni.uRes.value.set(r.width, r.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let visible = true;
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 });
      io.observe(canvas);
    }

    const panel = {
      render(dt) {
        uni.uTime.value += dt;
        if (visible) renderer.render(scene, cam);
      },
    };
    addPanel(panel);

    return () => {
      removePanel(panel);
      window.removeEventListener('resize', resize);
      if (io) io.disconnect();
      mat.dispose();
      renderer.dispose();
    };
  }, [color]);

  return <canvas ref={canvasRef} className="pd-hero__gl" />;
}
