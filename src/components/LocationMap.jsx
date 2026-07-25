import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CURRENT_LOCATION as LOC } from '../lib/location';
import './LocationMap.css';

function useLocalTime(tz) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => {
      try {
        setTime(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date())
        );
      } catch {
        setTime('');
      }
    };
    fmt();
    const id = setInterval(fmt, 30000);
    return () => clearInterval(id);
  }, [tz]);
  return time;
}

/**
 * Current-location indicator. Collapsed it's just a text label ("Pune, India");
 * clicking expands a dark CARTO mini-map with a pulsing pin. The map (and its
 * tiles) are only created on first open. Everything reads from lib/location.js.
 */
export default function LocationMap() {
  const rootRef = useRef(null);
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const time = useLocalTime(LOC.tz);

  // Build the Leaflet map only while expanded; tear it down on collapse.
  useEffect(() => {
    if (!open) return undefined;
    const el = elRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      center: [LOC.lat, LOC.lng],
      zoom: LOC.zoom ?? 11,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });
    mapRef.current = map;
    if (map.tap) map.tap.disable();

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; OSM &middot; CARTO',
    }).addTo(map);

    const icon = L.divIcon({
      className: 'locmap-pin',
      html: '<span class="locmap-pin__ring"></span><span class="locmap-pin__dot"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([LOC.lat, LOC.lng], { icon, keyboard: false, interactive: false }).addTo(map);

    // Re-measure after the expand animation settles.
    const t = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${LOC.lat},${LOC.lng}`;

  return (
    <div className="locmap" ref={rootRef} data-open={open || undefined}>
      <button
        type="button"
        className="locmap__chip"
        onClick={() => setOpen((o) => !o)}
        data-cursor
        aria-expanded={open}
        aria-label={`Currently in ${LOC.city}, ${LOC.country}. ${open ? 'Hide' : 'Show'} map`}
      >
        <span className="locmap__live" aria-hidden="true" />
        <span className="locmap__city">
          {LOC.city}, {LOC.country}
        </span>
        <svg className="locmap__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 4H4v5M15 20h5v-5" />
        </svg>
      </button>

      {open && (
        <div className="locmap__panel">
          <div ref={elRef} className="locmap__canvas" aria-hidden="true" />
          <div className="locmap__overlay">
            <span className="locmap__plabel">
              <span className="locmap__live" aria-hidden="true" />
              {LOC.city}
            </span>
            {time && <span className="locmap__time">{time} local</span>}
          </div>
          <a
            className="locmap__maps"
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor
          >
            Open in Maps ↗
          </a>
        </div>
      )}
    </div>
  );
}
