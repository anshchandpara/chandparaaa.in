/**
 * Your current base. Shown as a live mini-map in the hero. Update this object
 * whenever you relocate — the map re-centers, the label changes, and the live
 * local time follows the timezone.
 *
 * - lat / lng : right-click a spot in Google Maps → "What's here?" to copy them.
 * - tz        : IANA timezone, e.g. 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London'.
 * - zoom      : 9 (regional) – 13 (city); 11 is a good default.
 */
export const CURRENT_LOCATION = {
  city: 'Pune',
  country: 'India',
  lat: 18.5204,
  lng: 73.8567,
  zoom: 11,
  tz: 'Asia/Kolkata',
};
