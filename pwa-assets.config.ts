import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  type Preset,
} from "@vite-pwa/assets-generator/config";

/**
 * Bron: public/favicon.svg. Draaien met `pnpm generate-pwa-assets`.
 *
 * Bewust padding 0 overal (de presets defaulten op 0.3): de bron is al full-bleed
 * terracotta met het palmmotief binnen de middelste 70%. Met padding zou er een
 * transparante rand omheen komen, wat op iOS een witte kader rond het icoon geeft
 * en bij Android's maskable-crop transparante hoeken oplevert.
 */
const preset: Preset = {
  transparent: { sizes: [64, 192, 512], favicons: [[48, "favicon.ico"]], padding: 0 },
  maskable: { sizes: [512], padding: 0, resizeOptions: { background: "#c2683f" } },
  apple: { sizes: [180], padding: 0, resizeOptions: { background: "#c2683f" } },
};

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: combinePresetAndAppleSplashScreens(preset, {
    // iOS toont zonder launch-image een leeg vlak bij het opstarten van een
    // home-screen-app; padding houdt het palmicoon klein genoeg om op elk
    // schermformaat als logo te lezen in plaats van als paginavullende plaat.
    padding: 0.3,
    resizeOptions: { background: "#faf5ea", fit: "contain" },
    darkResizeOptions: { background: "#faf5ea", fit: "contain" },
    linkMediaOptions: { log: false, addMediaScreen: true, basePath: "/", xhtml: false },
  }),
  images: ["public/favicon.svg"],
});
