import Nav from './Nav';
import About, { AboutContact } from './About';
import Clients from './Clients';
import Archive from './Archive';
import Footer from './Footer';
import { useMode } from '../hooks/useMode';

/**
 * Standalone About page (`?page=about`): bio → clients → archive → contact.
 * The Work/Lab toggle stays available — Clients and Archive are mode-aware.
 */
export default function AboutPage() {
  const [mode, setMode] = useMode();

  return (
    <>
      <Nav mode={mode} onMode={setMode} />
      <main className="page-offset">
        <About />
        <Clients mode={mode} />
        <Archive mode={mode} />
        <AboutContact />
      </main>
      <Footer />
    </>
  );
}
