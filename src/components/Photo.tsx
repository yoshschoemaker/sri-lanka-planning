import { getPhotoAttrs } from "../utils/photos";

interface PhotoProps {
  /** Pad zoals content/trip.json het noemt, bijvoorbeeld "/ella.webp". */
  path: string | undefined;
  /** Leeg voor puur decoratief beeld naast tekst die hetzelfde al zegt. */
  alt: string;
  /** Zie PHOTO_SIZES in utils/photos.ts. */
  sizes: string;
  className?: string;
  /**
   * true voor beeld dat direct in beeld staat bij het laden van de pagina: dat
   * wil je niet lazy hebben, want dan wacht het onnodig op de layout.
   */
  priority?: boolean;
}

/**
 * Eén <img> voor alle foto's in de app: srcset uit het manifest, intrinsieke
 * afmetingen tegen layout shift, en lazy loading tenzij het beeld boven de vouw
 * staat. Zie utils/photos.ts voor de vertaling van pad naar varianten.
 */
export function Photo({ path, alt, sizes, className, priority = false }: PhotoProps) {
  const attrs = getPhotoAttrs(path, sizes);

  return (
    <img
      {...attrs}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
