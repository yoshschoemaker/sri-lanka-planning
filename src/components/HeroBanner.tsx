import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { getPhotoAttrs, PHOTO_SIZES } from "../utils/photos";

const HERO_PHOTO = "/ella.webp";

/** Decorative photo strip below the header; the image drifts at a slower rate than the page scroll for a subtle parallax depth cue. */
export function HeroBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  // Geen width/height op dit beeld: de CSS bepaalt hier zowel de breedte als de
  // hoogte (h-[180%] binnen een vaste strip), dus de intrinsieke maten zouden
  // alleen een aspect-ratio opleggen die niets meer stuurt. De srcset is wél
  // wat telt — dit was een bestand van 352 KB voor een strip van 160px hoog.
  const { width: _width, height: _height, ...attrs } = getPhotoAttrs(HERO_PHOTO, PHOTO_SIZES.fullWidth);

  return (
    <div ref={ref} className="relative h-40 w-full overflow-hidden sm:h-52 lg:h-64">
      <motion.img
        {...attrs}
        alt=""
        // Staat direct onder de header in beeld bij het laden: eager, zodat de
        // strip niet als grijs vlak begint.
        loading="eager"
        fetchPriority="high"
        className="absolute top-[-40%] h-[180%] w-full object-cover"
        style={{
          objectPosition: "50% 55%",
          y: prefersReducedMotion ? undefined : y,
        }}
      />
    </div>
  );
}
