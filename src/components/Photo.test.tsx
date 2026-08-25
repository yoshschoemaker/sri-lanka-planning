import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Photo } from "./Photo";
import { photoManifest } from "../data/photoManifest";
import { getPhotoAttrs, PHOTO_SIZES } from "../utils/photos";

/** Een pad dat echt in het manifest staat, zodat de test meegaat als de content verandert. */
const [knownPath, knownEntry] = Object.entries(photoManifest)[0];

/**
 * Deze foto's zijn decoratief (alt=""), en dan is de rol `presentation` en niet
 * `img`. Rechtstreeks opzoeken is hier duidelijker dan een rol-query.
 */
function img(): HTMLImageElement {
  const el = document.querySelector("img");
  if (!el) throw new Error("geen <img> gerenderd");
  return el;
}

describe("getPhotoAttrs", () => {
  it("bouwt een srcset uit alle varianten", () => {
    const attrs = getPhotoAttrs(knownPath, PHOTO_SIZES.cardThumb);
    for (const variant of knownEntry.variants) {
      expect(attrs.srcSet).toContain(`${variant.url} ${variant.width}w`);
    }
  });

  it("kiest de grootste variant als src", () => {
    const attrs = getPhotoAttrs(knownPath, PHOTO_SIZES.fullWidth);
    expect(attrs.src).toBe(knownEntry.variants[knownEntry.variants.length - 1].url);
  });

  it("geeft de intrinsieke afmetingen mee, tegen layout shift", () => {
    const attrs = getPhotoAttrs(knownPath, PHOTO_SIZES.cardThumb);
    expect(attrs.width).toBe(knownEntry.width);
    expect(attrs.height).toBe(knownEntry.height);
  });

  it("geeft de sizes door zoals aangeleverd", () => {
    expect(getPhotoAttrs(knownPath, PHOTO_SIZES.galleryThumb).sizes).toBe(PHOTO_SIZES.galleryThumb);
  });

  it("valt terug op het pad zelf voor een externe URL", () => {
    const attrs = getPhotoAttrs("https://example.com/foto.jpg", PHOTO_SIZES.fullWidth);
    expect(attrs.src).toBe("https://example.com/foto.jpg");
    expect(attrs.srcSet).toBeUndefined();
  });

  it("valt terug op het pad zelf voor een onbekende foto", () => {
    // Dit is de situatie waarin `pnpm photos` nog niet gedraaid heeft. De build
    // wordt daar door validate-content tegengehouden, maar de UI hoort er niet
    // op te breken.
    const attrs = getPhotoAttrs("/nog-niet-gegenereerd.webp", PHOTO_SIZES.cardThumb);
    expect(attrs.src).toBe("/nog-niet-gegenereerd.webp");
    expect(attrs.srcSet).toBeUndefined();
    expect(attrs.width).toBeUndefined();
  });

  it("levert een lege src voor een ontbrekend pad in plaats van te crashen", () => {
    expect(getPhotoAttrs(undefined, PHOTO_SIZES.cardThumb).src).toBe("");
  });

  it("noemt de varianten van klein naar groot", () => {
    for (const entry of Object.values(photoManifest)) {
      const widths = entry.variants.map((v) => v.width);
      expect(widths).toEqual([...widths].sort((a, b) => a - b));
    }
  });

  it("levert nooit een variant breder dan de bronfoto", () => {
    for (const [path, entry] of Object.entries(photoManifest)) {
      for (const variant of entry.variants) {
        expect(variant.width, path).toBeLessThanOrEqual(entry.width);
      }
    }
  });
});

describe("Photo", () => {
  it("laadt standaard lazy", () => {
    render(<Photo path={knownPath} alt="" sizes={PHOTO_SIZES.cardThumb} />);
    expect(img().getAttribute("loading")).toBe("lazy");
    expect(img().getAttribute("decoding")).toBe("async");
  });

  it("laadt beeld boven de vouw meteen", () => {
    render(<Photo path={knownPath} alt="" sizes={PHOTO_SIZES.fullWidth} priority />);
    expect(img().getAttribute("loading")).toBe("eager");
    expect(img().getAttribute("fetchpriority")).toBe("high");
  });

  it("zet de srcset en de afmetingen op het element", () => {
    render(<Photo path={knownPath} alt="" sizes={PHOTO_SIZES.cardThumb} />);
    const el = img();
    expect(el.getAttribute("srcset")).toContain("320w");
    expect(el.getAttribute("width")).toBe(String(knownEntry.width));
    expect(el.getAttribute("height")).toBe(String(knownEntry.height));
  });

  it("houdt een lege alt leeg voor decoratief beeld", () => {
    render(<Photo path={knownPath} alt="" sizes={PHOTO_SIZES.cardThumb} />);
    expect(img().getAttribute("alt")).toBe("");
  });

  it("geeft de meegegeven classes door", () => {
    render(<Photo path={knownPath} alt="" sizes={PHOTO_SIZES.cardThumb} className="object-cover" />);
    expect(img().className).toBe("object-cover");
  });
});
