import { useEffect, type RefObject } from "react";

/**
 * Wereld-eenheden dolly per pixel wheel-delta. Het hele afstandsbereik van de
 * camera is ~12 eenheden, en een stevige trackpad-pinch levert cumulatief al
 * gauw honderd pixels delta op: hiermee overbrug je dat bereik in één vloeiend
 * gebaar zonder dat een klein duwtje meteen op de aanslag knalt.
 */
const WHEEL_DOLLY_PER_PIXEL = 0.08;

/**
 * Safari's gesture-events geven geen pixels maar een cumulatieve schaalfactor
 * (1 bij aanvang). Een gewone pinch komt tot ongeveer 2, dus deze factor legt
 * daar ruwweg hetzelfde bereik onder als WHEEL_DOLLY_PER_PIXEL bij Chrome.
 */
const GESTURE_DOLLY_PER_SCALE = 10;

/** Alleen Safari kent deze events; TypeScript's DOM-lib niet. */
interface GestureEvent extends Event {
  scale: number;
}

/**
 * Maakt van een trackpad-pinch (en ⌘/ctrl+scroll) een camera-zoom in plaats van
 * een browser-zoom.
 *
 * De browser vertaalt een pinch op de trackpad naar ctrl+wheel (Chrome,
 * Firefox) of naar eigen gesture-events (Safari), en zoomt zonder
 * preventDefault de hele pagina. camera-controls doet dat preventDefault wel,
 * maar alleen op de canvas zelf: zodra de cursor boven een DOM-overlay hangt
 * (een stopbadge, de knoppenbalk) ontsnapt het gebaar alsnog naar de browser.
 * Vandaar één listener op de kaartwrapper, die alles eronder afdekt.
 *
 * Een scroll zónder modifier laten we bewust door: de kaart staat midden in een
 * lange pagina, en die hoort gewoon te scrollen als je eroverheen gaat.
 */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  dollyBy: (amount: number) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      dollyBy(-event.deltaY * WHEEL_DOLLY_PER_PIXEL);
    };

    let lastScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const { scale } = event as GestureEvent;
      dollyBy((scale - lastScale) * GESTURE_DOLLY_PER_SCALE);
      lastScale = scale;
    };
    const onGestureEnd = (event: Event) => event.preventDefault();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart, { passive: false });
    el.addEventListener("gesturechange", onGestureChange, { passive: false });
    el.addEventListener("gestureend", onGestureEnd, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
  }, [ref, dollyBy]);
}
