/**
 * About-page portrait. Drop a single image into src/media/about/ (or upload it
 * via the /admin form) and it appears beside the bio; remove it and the layout
 * gracefully collapses back to text-only. First sorted file wins.
 */
const modules = import.meta.glob('../media/about/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const ABOUT_PORTRAIT =
  Object.keys(modules)
    .sort()
    .map((k) => modules[k])[0] || '';
