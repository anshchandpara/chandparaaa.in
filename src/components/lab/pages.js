import { lazy } from 'react';

/**
 * Lab entries with a page of their own.
 *
 * Every `?p=<slug>` normally renders the generic ProjectPage. A slug listed
 * here renders its own component instead — the URL, the Archive link and the
 * "Next" link all keep working, because the slug is still the address.
 *
 * Each is a `lazy()` import, so a page's code (and anything only it pulls in)
 * lands in its own chunk and costs nothing until someone opens it. three.js
 * itself is already in the main bundle via CardCanvas / ProjectHeroCanvas, so
 * a scene here adds only the scene.
 *
 * The slug must also exist as a normal entry in src/data/projects.json — that
 * is what puts it in the Archive and gives it a code, a title and a year.
 */
export const LAB_PAGES = {
  reveries: lazy(() => import('./Reveries')),
};
