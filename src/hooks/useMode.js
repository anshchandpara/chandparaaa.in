import { useEffect, useState } from 'react';

const MODE_KEY = 'acPortfolioMode';

/**
 * Work/Lab mode, persisted to localStorage and shared by every page that
 * renders the Nav toggle (Home, About).
 */
export function useMode() {
  const [mode, setMode] = useState('work');

  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === 'work' || m === 'lab') setMode(m);
    } catch {
      /* ignore */
    }
  }, []);

  const handleMode = (m) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  return [mode, handleMode];
}
