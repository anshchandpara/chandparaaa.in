/**
 * Optional self-hosted hero loop for a project. Drop a `hero.mp4` (muted,
 * web-optimized, e.g. a timelapse) into `public/projects/<slug>/` and the
 * project page leads with it as an autoplaying loop instead of a still. It's a
 * single reserved filename (`hero.mp4`) so the manifest builder keeps it out of
 * the gallery. Vimeo `video` still wins if both are set.
 *
 * Lookup comes from the committed manifest, not a disk scan — see
 * `lib/mediaManifest.js`.
 */
import { projectEntry, mediaUrl } from './mediaManifest';

/**
 * The site's own background loop, self-hosted in /public (2560×1440, ~8.7 MB —
 * see docs/media-recipes.md for the encode recipe and the forced-keyframe
 * gotcha). Shared by the home Hero and the Landing gate so both resolve to one
 * cached request.
 *
 * NOT manifest-driven: it is a single fixed site asset rather than project
 * media, and it is referenced by the same name from two components.
 */
export const HERO_VIDEO = `${import.meta.env.BASE_URL}hero-loop.mp4`;
export const HERO_POSTER = `${import.meta.env.BASE_URL}hero-poster.jpg`;

export function getHeroVideo(slug) {
  const { hero } = projectEntry(slug);
  return hero ? mediaUrl(slug, hero) : '';
}
