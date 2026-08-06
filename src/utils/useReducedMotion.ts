import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * matchMedia-based reduced-motion flag, kept independent of any React context
 * so it can be dropped into DOM components and (later) a canvas/WebGL scene
 * alike. The global CSS reduced-motion rule in index.css only collapses CSS
 * transitions/animations; it does not reach Framer Motion's animate-prop
 * driven values or imperative APIs like Element.scrollIntoView, so those need
 * this hook explicitly.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQueryList = window.matchMedia(QUERY);

    const handleChange = () => setPrefersReducedMotion(mediaQueryList.matches);
    handleChange();

    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}
