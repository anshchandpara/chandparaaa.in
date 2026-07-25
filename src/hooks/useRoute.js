import { useEffect, useState } from 'react';

const NAV_EVENT = 'spa-nav';

function currentRoute() {
  const q = new URLSearchParams(window.location.search);
  return { slug: q.get('p'), page: q.get('page') };
}

/**
 * Minimal client-side route: `?p=<slug>` selects a project detail page,
 * `?page=<name>` a standalone page (currently "about"); absence of both is
 * the home page. Updates on back/forward and on intercepted in-app navs.
 */
export function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);

  return route;
}

/**
 * Intercept clicks on in-app links (`?p=…` project links, `?page=…` standalone
 * pages, and `./…` home links, including `./#hash`) so navigation happens
 * without a full reload. Returns a cleanup function. External links, hashes on
 * the current page, and mailto are left to the browser.
 */
export function installRouter() {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;

    const isProject = href.startsWith('?p=');
    const isPage = href.startsWith('?page=');
    const isHome = href === './' || href.startsWith('./#') || href === '/';
    if (!isProject && !isPage && !isHome) return;

    e.preventDefault();
    const url = new URL(href, window.location.href);
    window.history.pushState({}, '', url);
    window.dispatchEvent(new Event(NAV_EVENT));

    if (url.hash) {
      // Give the destination a tick to mount, then scroll to the anchor.
      setTimeout(() => {
        const el = document.querySelector(url.hash);
        if (el) el.scrollIntoView();
      }, 80);
    } else {
      window.scrollTo(0, 0);
    }
  };

  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
