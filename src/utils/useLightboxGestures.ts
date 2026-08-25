import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** Hoe ver je horizontaal moet slepen voordat het als "volgende foto" telt. Ruim boven de speling van een tik. */
const SWIPE_THRESHOLD_PX = 55;

/** Een veeg moet duidelijk horizontaal zijn, anders is het eerder een poging tot verticaal slepen of een tik. */
const SWIPE_DOMINANCE = 1.4;

/** Verplaatsing waarboven een aanraking geen tik meer is. Voorkomt dat een veeg de lightbox sluit. */
const TAP_SLOP_PX = 10;

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/** Waar een dubbeltik naartoe zoomt. Genoeg om detail te zien, niet zo ver dat je de foto kwijtraakt. */
const DOUBLE_TAP_SCALE = 2.5;

/** Twee tikken binnen dit venster gelden als dubbeltik. */
const DOUBLE_TAP_MS = 300;

interface Offset {
  x: number;
  y: number;
}

interface GestureOptions {
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** Het <img> zelf, om de sleepgrenzen op de werkelijk getoonde afmetingen te baseren. */
  imageRef: RefObject<HTMLImageElement | null>;
}

/**
 * Slepen, vegen en pinchen in de fotoweergave.
 *
 * De lightbox kon alleen met pijltjes en een klik bediend worden, wat op een
 * telefoon precies de twee dingen mist die je daar verwacht: vegen naar de
 * volgende foto en pinchen om in te zoomen.
 *
 * Alles loopt via pointer events, zodat vinger, muis en stylus dezelfde weg
 * volgen. De regels:
 *
 * - twee vingers pinchen, waarbij het punt tussen je vingers op zijn plek blijft;
 * - één vinger veegt naar de vorige of volgende foto zolang je niet ingezoomd bent;
 * - één vinger sleept de foto rond zodra je wél ingezoomd bent;
 * - dubbeltikken wisselt tussen passend en ingezoomd;
 * - na een veeg of sleep wordt de klik onderdrukt, anders sluit de lightbox
 *   zichzelf zodra je je vinger optilt.
 */
export function useLightboxGestures({ count, index, onIndexChange, imageRef }: GestureOptions) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  /** Horizontale versleping tijdens een veeg, puur als visuele terugkoppeling. */
  const [swipeX, setSwipeX] = useState(0);

  const pointers = useRef(new Map<number, Offset>());
  const dragStart = useRef<{ x: number; y: number; offset: Offset } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number; midpoint: Offset; offset: Offset } | null>(null);
  const moved = useRef(false);
  const lastTapAt = useRef(0);
  /** Gelezen door de klik-handler van de achtergrond, die ná pointerup afgaat. */
  const suppressClick = useRef(false);

  const zoomed = scale > MIN_SCALE + 0.01;

  // Een nieuwe foto begint altijd passend in beeld: de zoom van de vorige
  // meenemen levert een willekeurig uitsnede op van een foto die je nog niet
  // gezien hebt.
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setSwipeX(0);
  }, [index]);

  /**
   * Houdt de foto binnen bereik: bij schaal s kun je hoogstens de helft van wat
   * er buiten het kader valt naar het midden slepen. Zonder deze grens sleep je
   * de foto zo van het scherm af.
   */
  const clampOffset = useCallback(
    (next: Offset, atScale: number): Offset => {
      const el = imageRef.current;
      if (!el || atScale <= 1) return { x: 0, y: 0 };
      const maxX = (el.clientWidth * (atScale - 1)) / 2;
      const maxY = (el.clientHeight * (atScale - 1)) / 2;
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [imageRef],
  );

  const applyScale = useCallback(
    (nextScale: number, focus?: Offset) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      setScale(clamped);
      setOffset((previous) => clampOffset(focus ?? previous, clamped));
      return clamped;
    },
    [clampOffset],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    try {
      // Vangt af, niet omdat het vaak misgaat, maar omdat het gooit zodra de
      // pointer al vrijgegeven is (of synthetisch is). Zonder deze catch valt de
      // hele handler om en registreert de vinger zich niet, waarna het gebaar
      // stil niets doet.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Zonder capture werkt het gebaar nog steeds; alleen slepen buiten het
      // element is dan minder betrouwbaar.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;

    const points = [...pointers.current.values()];
    if (points.length === 2) {
      const [a, b] = points;
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        offset,
      };
      dragStart.current = null;
      // Een tweede vinger is nooit een tik, en de veeg die al liep is nu een pinch.
      moved.current = true;
      setSwipeX(0);
    } else if (points.length === 1) {
      dragStart.current = { x: event.clientX, y: event.clientY, offset };
    }
  }, [offset, scale]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const points = [...pointers.current.values()];

      if (points.length >= 2 && pinchStart.current) {
        const [a, b] = points;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const start = pinchStart.current;
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (start.scale * distance) / start.distance));

        // Het punt tussen je vingers vasthouden: schaalt de foto met factor k,
        // dan schuift alles onder dat punt met dezelfde factor weg, dus de
        // verschuiving moet mee-schalen om het stil te laten staan.
        const k = nextScale / start.scale;
        setScale(nextScale);
        setOffset(clampOffset({ x: start.offset.x * k, y: start.offset.y * k }, nextScale));
        return;
      }

      const start = dragStart.current;
      if (!start) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) moved.current = true;

      if (zoomed) {
        setOffset(clampOffset({ x: start.offset.x + dx, y: start.offset.y + dy }, scale));
      } else if (count > 1) {
        setSwipeX(dx);
      }
    },
    [clampOffset, count, scale, zoomed],
  );

  const endPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = dragStart.current;
      pointers.current.delete(event.pointerId);

      if (pointers.current.size === 0) {
        pinchStart.current = null;
        dragStart.current = null;
      } else if (pointers.current.size === 1) {
        // Van pinch terug naar één vinger: opnieuw beginnen te slepen vanaf hier,
        // anders springt de foto met het verschil van de opgetilde vinger.
        const [remaining] = [...pointers.current.values()];
        dragStart.current = { x: remaining.x, y: remaining.y, offset };
        pinchStart.current = null;
        return;
      }

      if (moved.current) suppressClick.current = true;

      // Veeg naar de vorige of volgende foto, alleen niet-ingezoomd.
      if (start && !zoomed && count > 1) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE) {
          onIndexChange(((dx < 0 ? index + 1 : index - 1) + count) % count);
        }
      }
      setSwipeX(0);

      // Dubbeltik: alleen als deze aanraking een tik was, niet een veeg.
      if (!moved.current) {
        const now = event.timeStamp;
        if (now - lastTapAt.current < DOUBLE_TAP_MS) {
          lastTapAt.current = 0;
          suppressClick.current = true;
          applyScale(zoomed ? 1 : DOUBLE_TAP_SCALE, { x: 0, y: 0 });
        } else {
          lastTapAt.current = now;
        }
      }

      if (!zoomed) setOffset({ x: 0, y: 0 });
    },
    [applyScale, count, index, offset, onIndexChange, zoomed],
  );

  /** True als de klik die hier direct op volgt uit een gebaar komt en dus niet mag sluiten. */
  const consumeSuppressedClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return {
    zoomed,
    scale,
    offset,
    swipeX,
    consumeSuppressedClick,
    /** Op de laag die de foto omsluit zetten, niet op de foto zelf: vegen moet ook naast het beeld werken. */
    gestureHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}
