import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" in plaats van "autoUpdate": een reisapp mag zichzelf niet midden
      // in het gebruik vervangen. UpdatePrompt.tsx vraagt het de gebruiker.
      registerType: 'prompt',
      strategies: 'generateSW',
      // Registratie loopt via virtual:pwa-register/react in UpdatePrompt.tsx.
      injectRegister: null,
      // Vult de manifest-icons en injecteert de apple-touch-icon- en
      // apple-touch-startup-image-links in index.html. Zie pwa-assets.config.ts.
      pwaAssets: { config: true, injectThemeColor: true },
      manifest: {
        id: '/',
        name: 'Sri Lanka rondreis · 2027',
        short_name: 'Sri Lanka',
        description:
          'Reisplanning voor de rondreis door Sri Lanka, 25 januari – 18 februari 2027.',
        lang: 'nl',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#faf5ea',
        theme_color: '#c2683f',
        categories: ['travel', 'lifestyle'],
      },
      workbox: {
        // webp/jpg/jpeg zitten niet in de plugin-default, maar de reisfoto's zijn
        // juist de content die offline beschikbaar moet zijn.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webp,jpg,jpeg}'],
        // ~820 KB aan iOS launch-images tegenover puur cosmetische winst. Zonder
        // deze bestanden valt iOS terug op background_color, wat toch al de kleur
        // van SplashScreen.tsx is.
        globIgnores: ['**/apple-splash-*.png'],
        // De three.js-chunk is ~1 MB en moet erin, anders faalt de lazy import van
        // TripMap3D offline en valt de kaart permanent terug op de 2D-versie.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        // Bewust leeg: de app doet na het self-hosten van de fonts geen enkele
        // runtime-request. Alles zit in de precache.
        runtimeCaching: [],
      },
      // Een actieve service worker in `vite dev` verbergt HMR-wijzigingen.
      // De testloop voor PWA-gedrag is `pnpm build && pnpm preview`.
      devOptions: { enabled: false, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
})
