import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import adminPlugin from './tools/vite-admin-plugin.js';
import renderPlugin from './tools/vite-render-plugin.js';

// Base is './' so the build can be served from a subpath (e.g. GitHub Pages).
// adminPlugin serves a dev-only project-authoring form at /admin (apply:'serve').
// renderPlugin serves a dev-only Higgsfield render queue at /render (apply:'serve').
export default defineConfig({
  plugins: [react(), adminPlugin(), renderPlugin()],
  base: './',
  // Honour the harness-assigned PORT env var (autoPort), else default 5173.
  server: { port: Number(process.env.PORT) || 5173, open: false },
});
