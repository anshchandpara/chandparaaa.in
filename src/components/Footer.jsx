import { CURRENT_LOCATION } from '../lib/location';

export default function Footer() {
  return (
    <footer className="foot">
      <span>© 2026 Chandparaaa</span>
      <span>Creative Director · Title Designer · Filmmaker</span>
      <span>{CURRENT_LOCATION.city}, {CURRENT_LOCATION.country}</span>
    </footer>
  );
}
