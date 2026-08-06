import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";

/** Decorative photo strip below the header; the image drifts at a slower rate than the page scroll for a subtle parallax depth cue. */
export function HeroBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-30%", "30%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1, 1.15]);

  return (
    <div ref={ref} className="relative h-40 w-full overflow-hidden sm:h-52 lg:h-64">
      <motion.img
        src="/ella.webp"
        alt=""
        className="absolute top-[-30%] h-[160%] w-full object-cover"
        style={{
          objectPosition: "50% 55%",
          y: prefersReducedMotion ? undefined : y,
          scale: prefersReducedMotion ? undefined : scale,
        }}
      />
    </div>
  );
}
