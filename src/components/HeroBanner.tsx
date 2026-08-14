import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";

/** Decorative photo strip below the header; the image drifts at a slower rate than the page scroll for a subtle parallax depth cue. */
export function HeroBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <div ref={ref} className="relative h-40 w-full overflow-hidden sm:h-52 lg:h-64">
      <motion.img
        src="/ella.webp"
        alt=""
        className="absolute top-[-40%] h-[180%] w-full object-cover"
        style={{
          objectPosition: "50% 55%",
          y: prefersReducedMotion ? undefined : y,
        }}
      />
    </div>
  );
}
