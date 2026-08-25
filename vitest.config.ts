import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Bewust los van vite.config.ts. Die trekt via vite-plugin-pwa de
 * assets-generator en daarmee sharp binnen, en dan laadt elke testrun twee
 * verschillende libvips-versies in hetzelfde proces (met een objc-waarschuwing
 * tot gevolg). De tests hebben van die hele pijplijn niets nodig.
 *
 * Twee projecten, gesplitst op bestandsextensie:
 *
 * - `.test.ts` is pure logica (datums, checklist, projecties) en draait in node.
 *   Snel, en geen jsdom die verbergt dat er per ongeluk een browser-API in een
 *   rekenfunctie is geslopen.
 * - `.test.tsx` rendert componenten en hooks en heeft jsdom plus de react-plugin
 *   voor JSX nodig.
 */

/** vite.config.ts levert deze in de echte build; utils/appVersion.ts leest ze. */
const appDefines = {
  __APP_VERSION__: JSON.stringify("0.0.0-test"),
  __APP_COMMIT__: JSON.stringify("test"),
  __APP_BUILD_TIME__: JSON.stringify("2027-01-01T00:00:00.000Z"),
};

export default defineConfig({
  test: {
    projects: [
      {
        define: appDefines,
        test: {
          name: "logica",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        define: appDefines,
        plugins: [react()],
        test: {
          name: "componenten",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
