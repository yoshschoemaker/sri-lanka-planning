import { photoManifest, type PhotoEntry } from "../data/photoManifest";

/**
 * Zet een foto-pad uit content/trip.json om in de attributen voor een <img>.
 *
 * De content noemt één pad ("/ella.webp"); wat er daadwerkelijk uitgeleverd
 * wordt zijn de varianten uit public/photos/ (zie scripts/generate-photos.mjs).
 * Deze functie doet die vertaling op één plek, zodat elk beeld in de app dezelfde
 * srcset, dezelfde intrinsieke afmetingen en dezelfde lazy-loading krijgt.
 */

export interface PhotoAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

/** Het manifest-record voor een pad, of undefined voor een externe URL of een onbekend pad. */
export function getPhotoEntry(path: string | undefined): PhotoEntry | undefined {
  if (!path) return undefined;
  return photoManifest[path];
}

/**
 * `sizes` beschrijft hoe breed het beeld op het scherm wordt getoond, niet hoe
 * groot het bestand is. Zonder die hint gaat de browser uit van 100vw en pakt
 * hij voor een duimnagel van 128px alsnog de grootste variant.
 */
export function getPhotoAttrs(path: string | undefined, sizes: string): PhotoAttrs {
  const entry = getPhotoEntry(path);

  // Externe URL's en paden zonder varianten (bijvoorbeeld een net toegevoegde
  // foto waarvoor `pnpm photos` nog niet gedraaid heeft) vallen terug op het
  // pad zoals het er staat. `pnpm validate` slaat daar alarm op, maar de UI
  // hoort er niet op te breken.
  if (!entry) return { src: path ?? "" };

  const largest = entry.variants[entry.variants.length - 1];

  return {
    src: largest.url,
    srcSet: entry.variants.map((variant) => `${variant.url} ${variant.width}w`).join(", "),
    sizes,
    width: entry.width,
    height: entry.height,
  };
}

/**
 * De breedtes waarop de app foto's toont, als benoemde `sizes`-waarden. Ze
 * staan hier bij elkaar zodat een aanpassing aan een thumbnail-formaat in de
 * CSS niet stilletijds uit de pas gaat lopen met de hint die de browser krijgt.
 */
export const PHOTO_SIZES = {
  /** StopCard-omslagje: h-12 w-12, sm:h-16 w-16. */
  cardThumb: "(min-width: 640px) 64px, 48px",
  /** PhotoGallery-strip: w-32, sm:w-36. */
  galleryThumb: "(min-width: 640px) 144px, 128px",
  /** ActivityCard-uitklap: w-20. */
  activityThumb: "80px",
  /** Hero-strip en lightbox: schermvullend. */
  fullWidth: "100vw",
} as const;
