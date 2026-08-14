import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * Korte commit-hash bij de versie in het instellingenpaneel: het versienummer
 * alleen zegt niets over welke build er daadwerkelijk op je toestel staat.
 */
function commitHash(): string {
  // Vercel cloont shallow, maar zet de sha wel in de omgeving.
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'onbekend'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitHash()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
        // Bewust niet vastgezet op portrait: iOS negeert het veld toch, en op een
        // Android-tablet zou het de app in staand formaat opsluiten terwijl de
        // kaart en de dagoverzichten liggend juist meer ruimte krijgen.
        orientation: 'any',
        // Heropent het bestaande venster in plaats van een tweede te starten,
        // bijvoorbeeld wanneer je de app vanaf de desktop nog eens aanklikt.
        launch_handler: { client_mode: 'navigate-existing' },
        // Terracotta in plaats van cream: dit is de splash-achtergrond van de
        // geïnstalleerde app (Android tekent er het icoon op, iOS gebruikt het als
        // terugval zonder launch-image). Gelijk aan het icoonvlak, zodat het icoon
        // niet als los blokje op de achtergrond ligt.
        background_color: '#c2683f',
        theme_color: '#c2683f',
        categories: ['travel', 'lifestyle'],
        // Zonder screenshots toont Chrome op Android de smalle infobar in plaats
        // van de installatiedialoog met voorbeeld. De narrow-variant is de enige
        // die Android gebruikt; wide is voor desktop.
        screenshots: [
          {
            src: 'screenshot-narrow.webp',
            sizes: '412x915',
            type: 'image/webp',
            form_factor: 'narrow',
            label: 'Overzicht van de reis met aftelteller en dagplanning',
          },
          {
            src: 'screenshot-wide.webp',
            sizes: '1280x800',
            type: 'image/webp',
            form_factor: 'wide',
            label: 'Overzicht van de reis met aftelteller en dagplanning',
          },
        ],
      },
      workbox: {
        // webp/jpg/jpeg zitten niet in de plugin-default, maar de reisfoto's zijn
        // juist de content die offline beschikbaar moet zijn.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webp,jpg,jpeg}'],
        // ~820 KB aan iOS launch-images tegenover puur cosmetische winst. Zonder
        // deze bestanden valt iOS terug op background_color, dezelfde terracotta,
        // dus dan mis je alleen de palm.
        // De screenshots hebben dezelfde behandeling verdiend: ze zijn alleen
        // nodig in de installatiedialoog, dus vóór de app offline gaat.
        globIgnores: ['**/apple-splash-*.png', '**/screenshot-*.webp'],
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
