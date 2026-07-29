import { useState } from 'react';
import { useReveal } from '../hooks/useReveal';
import { useMagnetic } from '../hooks/useMagnetic';
import data from '../data/projects.json';
import { ABOUT_PORTRAIT } from '../lib/aboutImage';
import Lightbox from './Lightbox';
import './About.css';

// Projects count is derived from the dataset (published only — drafts are
// hidden site-wide) so it never drifts; Years and Platforms are curated
// editorial figures (not cleanly derivable from the data).
const publishedCount = data.work.filter((p) => !p.draft).length;
const STATS = [
  { label: 'Years', value: '06' },
  { label: 'Projects', value: String(publishedCount).padStart(2, '0') },
  { label: 'Platforms', value: '07' },
];

const SOCIALS = ['Instagram', 'Vimeo', 'Behance', 'LinkedIn'];

/** Bio + stats. The contact block is separate (AboutContact) so the About
 *  page can slot Clients/Archive between them. */
export default function About() {
  const ref = useReveal([]);
  const [lbOpen, setLbOpen] = useState(false);

  return (
    <section ref={ref} id="about" className="section about" data-screen-label="About">
      <p className="eyebrow" data-rv>01 — About</p>
      <div className="about__grid">
        <div className="about__lead">
          <h2 className="about__heading" data-rv>A study in motion, story &amp; type.</h2>
          {ABOUT_PORTRAIT && (
            <figure className="about__portrait" data-rv>
              <img
                src={ABOUT_PORTRAIT}
                alt="Ansh Chandpara — portrait"
                loading="lazy"
                decoding="async"
                data-cursor
                data-cursor-label="Expand"
                onClick={() => setLbOpen(true)}
              />
            </figure>
          )}
          {lbOpen && (
            <Lightbox
              images={[{ src: ABOUT_PORTRAIT, alt: 'Ansh Chandpara — portrait' }]}
              index={0}
              onClose={() => setLbOpen(false)}
              onNavigate={() => {}}
            />
          )}
        </div>
        <div className="about__body" data-rv>
          <p>
            Ansh Chandpara is a creative director and title designer working across film, streaming,
            and brand. His practice sits at the intersection of motion, typography, and
            cinematic storytelling.
          </p>
          <p>
            Alongside commissioned work, the Lab is an open archive of experiments — type
            studies, motion sketches, and unfinished ideas kept in their raw state.
          </p>
          <dl className="about__stats">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Email + socials — the closing block of the About page (`id="contact"`
 *  preserved for old anchors). */
export function AboutContact() {
  const ref = useReveal([]);
  const mailRef = useMagnetic();

  return (
    <section ref={ref} id="contact" className="section about about--contact" data-screen-label="Contact">
      <div className="about__contact" data-rv>
        <p className="eyebrow">Get in touch</p>
        <a
          ref={mailRef}
          href="mailto:hello@anshchandpara.com"
          className="about__mail"
          data-cursor
          data-magnetic
        >
          hello@anshchandpara.com
        </a>
        <div className="about__socials">
          {SOCIALS.map((s) => (
            <a key={s} href="#" data-cursor>{s}</a>
          ))}
        </div>
      </div>
    </section>
  );
}
