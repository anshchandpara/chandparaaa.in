import { useEffect } from 'react';
import Cursor from './components/Cursor';
import FuiGrid from './components/FuiGrid';
import Home from './components/Home';
import AboutPage from './components/AboutPage';
import ProjectPage from './components/ProjectPage';
import { useRoute, installRouter } from './hooks/useRoute';

export default function App() {
  const { slug, page } = useRoute();

  // Intercept in-app links for client-side navigation (no full reload).
  useEffect(() => installRouter(), []);

  let view;
  let key;
  if (slug) {
    view = <ProjectPage key={slug} slug={slug} />;
    key = `p:${slug}`;
  } else if (page === 'about') {
    view = <AboutPage />;
    key = 'about';
  } else {
    view = <Home />;
    key = 'home';
  }

  return (
    <>
      {/* FUI backdrop first — everything after paints on top of it. */}
      <FuiGrid />
      <Cursor />
      {/* Keyed wrapper re-runs the fade on every route change. Opacity-only —
          a transform here would break the fixed nav inside. */}
      <div key={key} className="page-fade">
        {view}
      </div>
    </>
  );
}
