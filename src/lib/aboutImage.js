/**
 * About-page portrait. Drop a single image into `public/about/` (or upload it
 * via the /admin form) and it appears beside the bio; remove it and the layout
 * gracefully collapses back to text-only. First sorted file wins.
 *
 * Enumeration comes from the committed manifest, not a disk scan — see
 * `lib/mediaManifest.js`.
 */
import { aboutFiles, aboutUrl } from './mediaManifest';

const first = aboutFiles()[0];

export const ABOUT_PORTRAIT = first ? aboutUrl(first) : '';
