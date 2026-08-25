import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Lightbox } from "./Lightbox";

const photos = ["/ella.webp", "/sigiriya.jpg", "/kandy.jpeg"];

/** De laag die de gestures opvangt; die zit op de wrapper, niet op de <img> zelf. */
function gestureLayer(): HTMLElement {
  const layer = document.querySelector<HTMLElement>('[style*="touch-action"]');
  if (!layer) throw new Error("gesture-laag niet gevonden");
  return layer;
}

function image(): HTMLImageElement {
  return screen.getByRole("img") as HTMLImageElement;
}

function setup(overrides: { index?: number; photos?: string[] } = {}) {
  const onClose = vi.fn();
  const onIndexChange = vi.fn();
  render(
    <Lightbox
      photos={overrides.photos ?? photos}
      index={overrides.index ?? 0}
      alt="Ella"
      onClose={onClose}
      onIndexChange={onIndexChange}
    />,
  );
  return { onClose, onIndexChange };
}

/** Sleept met één vinger van (x, y) over (dx, dy) in stappen, zoals een echte veeg. */
function drag(target: HTMLElement, from: { x: number; y: number }, dx: number, dy = 0, pointerId = 1) {
  fireEvent.pointerDown(target, { pointerId, clientX: from.x, clientY: from.y, isPrimary: true });
  for (let step = 1; step <= 5; step++) {
    fireEvent.pointerMove(target, {
      pointerId,
      clientX: from.x + (dx * step) / 5,
      clientY: from.y + (dy * step) / 5,
    });
  }
  fireEvent.pointerUp(target, { pointerId, clientX: from.x + dx, clientY: from.y + dy });
}

function pinch(target: HTMLElement, fromGap: number, toGap: number) {
  const cx = 200;
  const cy = 200;
  fireEvent.pointerDown(target, { pointerId: 1, clientX: cx - fromGap / 2, clientY: cy, isPrimary: true });
  fireEvent.pointerDown(target, { pointerId: 2, clientX: cx + fromGap / 2, clientY: cy });
  for (let step = 1; step <= 5; step++) {
    const gap = fromGap + ((toGap - fromGap) * step) / 5;
    fireEvent.pointerMove(target, { pointerId: 1, clientX: cx - gap / 2, clientY: cy });
    fireEvent.pointerMove(target, { pointerId: 2, clientX: cx + gap / 2, clientY: cy });
  }
  fireEvent.pointerUp(target, { pointerId: 2, clientX: cx + toGap / 2, clientY: cy });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: cx - toGap / 2, clientY: cy });
}

function scaleOf(el: HTMLElement): number {
  const match = /scale\(([0-9.]+)\)/.exec(el.style.transform);
  return match ? Number(match[1]) : 1;
}

describe("Lightbox, toetsenbord", () => {
  it("sluit op Escape", () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gaat met de pijltjes vooruit en achteruit", () => {
    const { onIndexChange } = setup({ index: 1 });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it("loopt met de pijltjes rond langs de randen", () => {
    const { onIndexChange } = setup({ index: 0 });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenLastCalledWith(photos.length - 1);
  });

  it("reageert niet op pijltjes bij één foto", () => {
    const { onIndexChange } = setup({ photos: ["/ella.webp"] });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onIndexChange).not.toHaveBeenCalled();
  });
});

describe("Lightbox, vegen", () => {
  it("gaat naar de volgende foto bij een veeg naar links", () => {
    const { onIndexChange } = setup({ index: 0 });
    drag(gestureLayer(), { x: 300, y: 200 }, -120);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("gaat naar de vorige foto bij een veeg naar rechts", () => {
    const { onIndexChange } = setup({ index: 1 });
    drag(gestureLayer(), { x: 100, y: 200 }, 120);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("loopt rond bij een veeg voorbij de laatste foto", () => {
    const { onIndexChange } = setup({ index: photos.length - 1 });
    drag(gestureLayer(), { x: 300, y: 200 }, -120);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("doet niets bij een veeg onder de drempel", () => {
    const { onIndexChange } = setup({ index: 0 });
    drag(gestureLayer(), { x: 300, y: 200 }, -30);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("negeert een sleep die vooral verticaal is", () => {
    const { onIndexChange } = setup({ index: 0 });
    drag(gestureLayer(), { x: 300, y: 200 }, -70, -200);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("veegt niet bij één foto", () => {
    const { onIndexChange } = setup({ photos: ["/ella.webp"] });
    drag(gestureLayer(), { x: 300, y: 200 }, -120);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("sluit niet na een veeg", () => {
    // Een veeg eindigt ook in een klik op de achtergrond; zonder onderdrukking
    // klapt de lightbox dan dicht zodra je je vinger optilt.
    const { onClose } = setup({ index: 0 });
    const layer = gestureLayer();
    drag(layer, { x: 300, y: 200 }, -120);
    fireEvent.click(layer);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sluit wel bij een gewone klik naast de foto", () => {
    const { onClose } = setup();
    fireEvent.click(gestureLayer());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Lightbox, zoomen", () => {
  it("zoomt in bij een pinch naar buiten", () => {
    setup();
    pinch(gestureLayer(), 100, 250);
    expect(scaleOf(image())).toBeGreaterThan(1.5);
  });

  it("gaat niet onder passend bij een pinch naar binnen", () => {
    setup();
    pinch(gestureLayer(), 250, 40);
    expect(scaleOf(image())).toBe(1);
  });

  it("zoomt niet verder dan de bovengrens", () => {
    setup();
    pinch(gestureLayer(), 40, 4000);
    expect(scaleOf(image())).toBeLessThanOrEqual(4);
  });

  it("wisselt met een dubbeltik tussen passend en ingezoomd", () => {
    setup();
    const layer = gestureLayer();
    const tap = () => {
      fireEvent.pointerDown(layer, { pointerId: 1, clientX: 200, clientY: 200, isPrimary: true });
      fireEvent.pointerUp(layer, { pointerId: 1, clientX: 200, clientY: 200 });
    };
    tap();
    tap();
    expect(scaleOf(image())).toBeGreaterThan(2);
    tap();
    tap();
    expect(scaleOf(image())).toBe(1);
  });

  it("veegt niet meer zodra je ingezoomd bent, maar sleept de foto", () => {
    const { onIndexChange } = setup({ index: 0 });
    const layer = gestureLayer();
    pinch(layer, 100, 250);
    drag(layer, { x: 300, y: 200 }, -120);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(image().style.transform).toContain("translate3d(-");
  });

  it("begint een nieuwe foto weer passend in beeld", () => {
    // De zoom van de vorige foto meenemen levert een willekeurige uitsnede op
    // van een foto die je nog niet gezien hebt.
    function Harness() {
      const [index, setIndex] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setIndex(1)}>
            volgende
          </button>
          <Lightbox photos={photos} index={index} alt="Ella" onClose={() => {}} onIndexChange={setIndex} />
        </>
      );
    }
    render(<Harness />);
    const layer = gestureLayer();
    pinch(layer, 100, 250);
    expect(scaleOf(image())).toBeGreaterThan(1.5);
    fireEvent.click(screen.getByRole("button", { name: "volgende" }));
    expect(scaleOf(image())).toBe(1);
  });
});
