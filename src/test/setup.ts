import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Opzet voor de component-tests (het jsdom-project in vitest.config.ts).
 */

afterEach(() => {
  cleanup();
  // De hooks in deze app bewaren spullen buiten React: checklistProgress schrijft
  // naar localStorage en useDialog zet body-overflow. Zonder opruimen lekt de
  // staat van de ene test naar de volgende.
  window.localStorage.clear();
  document.body.style.overflow = "";
});

/**
 * jsdom kent geen layout, dus clientWidth/clientHeight zijn overal 0. De
 * lightbox begrenst zijn sleepruimte daarop, en met 0 zou elke verschuiving
 * naar 0 worden teruggeklemd en zou een test over slepen niets kunnen aantonen.
 * Eén vaste maat voor alle elementen is hier genoeg.
 */
const LAYOUT_SIZE = 400;

for (const property of ["clientWidth", "clientHeight"] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get() {
      return LAYOUT_SIZE;
    },
  });
}

/** jsdom implementeert deze niet; de gesture-hook vangt de fout al op, maar dan blijft de test wel ruis loggen. */
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
}

/** matchMedia gebruiken useMediaQuery en useReducedMotion; jsdom levert hem niet. */
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
