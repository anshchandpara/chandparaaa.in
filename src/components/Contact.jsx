import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMagnetic } from '../hooks/useMagnetic';
import './Contact.css';

gsap.registerPlugin(ScrollTrigger);

const SOCIALS = ['Instagram', 'Vimeo', 'Behance', 'LinkedIn'];

export default function Contact() {
  const sectionRef = useRef(null);
  const lineRefs = useRef([]);
  const mailRef = useMagnetic();

  useEffect(() => {
    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lines = lineRefs.current.filter(Boolean);
    const eyebrow = sectionRef.current?.querySelector('[data-rv]');

    if (eyebrow) gsap.set(eyebrow, { opacity: 0, y: 16 });

    if (reduced) {
      gsap.set(lines, { yPercent: 0 });
      if (eyebrow) gsap.set(eyebrow, { opacity: 1, y: 0 });
      return undefined;
    }

    gsap.set(lines, { yPercent: 110 });
    const st = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 76%',
      onEnter: () => {
        gsap.to(lines, { yPercent: 0, duration: 0.55, ease: 'none', stagger: 0.05 });
        if (eyebrow) gsap.to(eyebrow, { opacity: 1, y: 0, duration: 0.4, ease: 'none' });
      },
    });
    ScrollTrigger.refresh();
    return () => st.kill();
  }, []);

  return (
    <section ref={sectionRef} id="contact" className="section contact" data-screen-label="Contact">
      <p className="eyebrow contact__eyebrow" data-rv>05 — Contact</p>

      <h2 className="contact__head">
        {["Let's make", 'something.'].map((line, i) => (
          <span key={line} className="contact__line-mask">
            <span
              ref={(el) => (lineRefs.current[i] = el)}
              className={`contact__line${i === 1 ? ' contact__line--accent' : ''}`}
            >
              {line}
            </span>
          </span>
        ))}
      </h2>

      <a
        ref={mailRef}
        href="mailto:hello@anshchandpara.com"
        className="contact__mail"
        data-cursor
        data-magnetic
      >
        hello@anshchandpara.com
      </a>

      <div className="contact__socials">
        {SOCIALS.map((s) => (
          <a key={s} href="#" data-cursor>{s}</a>
        ))}
      </div>
    </section>
  );
}
