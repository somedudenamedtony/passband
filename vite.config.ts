/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// D2: served from a project path on GitHub Pages. Every asset and the service-worker scope
// derive from this; nothing in src/ may hardcode '/'.
const base = process.env.PASSBAND_BASE ?? '/passband/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Passband',
        short_name: 'Passband',
        description: 'Work amateur radio satellites: passes, pointing, Doppler, logging.',
        theme_color: '#1b1e20',
        background_color: '#1b1e20',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // D4: the catalog changes daily and is cached in IndexedDB by the app itself.
        globIgnores: ['**/catalog.json', '**/sat-images/**'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
