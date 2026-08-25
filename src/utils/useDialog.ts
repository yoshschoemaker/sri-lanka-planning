import { useEffect, useRef } from "react";

/** Selector voor alles wat in een dialoog focus kan krijgen. `[hidden]` en disabled elementen vallen af. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Of dit element nu daadwerkelijk te bereiken is.
 *
 * Bewust "insluiten tenzij aantoonbaar verborgen", en niet het omgekeerde. Dit
 * stond eerst op `offsetParent !== null`, wat klopt in een browser maar alles
 * uitsluit zodra er geen layout-informatie is (jsdom in de tests, en een
 * dialoog die nog aan het invouwen is). Een focus-trap die per ongeluk niemand
 * toelaat is erger dan een die één onzichtbare knop meeneemt.
 */
function isReachable(el: HTMLElement): boolean {
  if (el.hidden) return false;
  return typeof el.checkVisibility === "function" ? el.checkVisibility() : true;
}

/**
 * Hoeveel dialogen er nu open staan. Nodig omdat de lightbox bovenop de
 * uitklap van een stop opent en de instellingen bovenop de kaart: met alleen
 * een save-and-restore per dialoog heft de bovenste bij het sluiten de lock van
 * de onderliggende op, en scrollt de pagina achter een nog open dialoog weer.
 */
let openCount = 0;
let restoreOverflow = "";

function lockScroll() {
  if (openCount === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  openCount += 1;
}

function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.style.overflow = restoreOverflow;
}

interface DialogOptions {
  open: boolean;
  onClose: () => void;
  /**
   * false voor een overlay die geen echte dialoog is en de focus dus niet mag
   * opeisen, zoals de splash. Scroll-lock blijft dan wel gelden.
   */
  trapFocus?: boolean;
}

/**
 * Het gedrag dat elke dialoog in deze app hoort te hebben, op één plek:
 *
 * - de pagina eronder scrollt niet mee (gestapeld geteld, zie openCount);
 * - Escape sluit;
 * - Tab blijft binnen de dialoog in plaats van door de achtergrond te lopen;
 * - de focus gaat bij openen naar de dialoog en bij sluiten terug naar het
 *   element dat hem opende, zodat je met het toetsenbord niet je plek verliest.
 *
 * Zet de teruggegeven ref op het element dat de dialoog omsluit.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>({ open, onClose, trapFocus = true }: DialogOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  useEffect(() => {
    if (!open || !trapFocus) return;

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Eén frame wachten: bij een dialoog die met een animatie binnenkomt staat
    // de inhoud er op dit moment nog niet altijd.
    const focusFrame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      // Een element dat zelf al autoFocus heeft gekregen niet overrulen.
      if (container.contains(document.activeElement)) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus();
    });

    return () => {
      cancelAnimationFrame(focusFrame);
      // Alleen terugzetten als de focus nog binnen deze dialoog zat: is hij
      // ondertussen ergens anders bewust neergezet, dan hoort die te blijven.
      const target = previouslyFocused.current;
      if (target && document.body.contains(target)) target.focus();
    };
  }, [open, trapFocus]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !trapFocus) return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isReachable);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Aan de randen doorlussen in plaats van uit de dialoog stappen.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, trapFocus]);

  return containerRef;
}
