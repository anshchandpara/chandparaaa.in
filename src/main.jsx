import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.jsx';
import { applyDesign } from './lib/design';

applyDesign(); // /admin Design tab → :root CSS variables

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
