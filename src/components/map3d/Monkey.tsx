import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import type { WorldPoint } from "../../utils/projection3d";
import { getLimbAnchor } from "./JungleTree";

/**
 * Purple-faced langur: grey-brown coat, near-white whisker ruff, bare dark face.
 *
 * The real animal is darker than this. It was authored at near-black first, and
 * against the wet zone's dark green canopy the whole monkey simply disappeared at
 * the size it actually renders at — the same reason Leopard.tsx sits at a warm
 * #c9903f. The pale ruff carries most of the readability at a distance, so it is
 * pushed brighter than a photograph would justify too.
 */
const COAT_COLOR = "#8a7a68";
const PALE_COLOR = "#efe6d4";
const FACE_COLOR = "#2b2521";

/** Body primitives below are authored at 1x; this blows the whole critter up so it reads at diorama viewing distance. Smaller than the ground animals' 2.6, since this one has to fit under a tree limb rather than stand on open grass. */
const SCALE = 1.5;

/** Local distance from the limb down to the body's centre. Matched to the arm below (shoulder + upper arm + hand ≈ 0.053), so the gripping hand closes just over the branch instead of floating under it. */
const HANG_LEN = 0.05;
const HANG_WORLD = HANG_LEN * SCALE;

/** How far forward it has swung at the moment it lets go, in radians from straight down. */
const SWING_MAX = 0.85;
/** How far *back* it is still swinging when it catches the next limb, as a fraction of SWING_MAX. Also where the next wind-up starts, so a catch flows straight into the following swing. */
const CATCH_FRACTION = 0.4;
const CATCH_ANGLE = SWING_MAX * CATCH_FRACTION;
/**
 * Half-cycles of pendulum per wind-up. Must be odd: that is what puts the swing
 * at its forward extreme exactly when the hop's release moment arrives, instead
 * of letting go while swinging backwards.
 */
const SWING_HALF_CYCLES = 3;
/** Fraction of one hop spent hanging and winding up; the rest is airborne. */
const RELEASE_AT = 0.62;
/** Apex of the leap above the straight line between release and catch, as a fraction of the gap being crossed. */
const ARC_FACTOR = 0.42;
/** How fast the body turns to face the way it is going. Slow enough to see it turn itself around at the end of the row, fast enough to be settled long before it lets go. */
const YAW_LAMBDA = 7;

/** Seconds the chatter reaction plays before settling back. */
const REACTION_DURATION = 1.4;

/**
 * One appearance is one trip up the row of trees and back, so VISIBLE_FOR is
 * really "six hops long". Gone for a minute-ish in between: the whole point is
 * that you catch it now and then rather than watch it on a loop.
 */
const VISIBLE_FOR = 16;
const MIN_GAP = 40;
const MAX_GAP = 95;

/**
 * Rest pose of the three tail segments, root outward: dropping from the rump,
 * then curling back and up toward the tip. Cumulative, so these read as 26, 54
 * and 89 degrees off vertical. An earlier pose started much closer to horizontal
 * and the tail read as a twig stuck to the animal rather than as a tail hanging
 * off it.
 */
const TAIL_REST = [0.45, 0.5, 0.6];

interface Anchor {
  x: number;
  y: number;
  z: number;
}

/** Where the body hangs when the pendulum is at `theta`, for a monkey facing `heading`. */
function hangPoint(a: Anchor, heading: number, theta: number): Anchor {
  const out = Math.sin(theta) * HANG_WORLD;
  return {
    x: a.x + Math.sin(heading) * out,
    y: a.y - Math.cos(theta) * HANG_WORLD,
    z: a.z + Math.cos(heading) * out,
  };
}

/**
 * A purple-faced langur working its way along the grove: it hangs by its arms
 * from one tree's limb, swings itself back and forth until it has enough of an
 * arc, lets go at the top of the forward swing, sails through the gap with its
 * legs tucked and its tail streaming, catches the next limb still swinging
 * backwards, and carries straight on into the next wind-up. At the end of the
 * row it turns itself around on the branch and comes back.
 *
 * The pendulum is real rather than faked with a sine on the position: the whole
 * animal hangs off a pivot placed *at the limb*, so swinging is one rotation and
 * the arms stay attached to the branch by construction. The release and catch
 * points of the flight are derived from that same pivot geometry (hangPoint), so
 * letting go and grabbing on are continuous in both position and pose — no pop
 * at either end of a leap.
 *
 * Comes and goes on its own timer like Leopard/Elephant do, but rarer: one trip
 * along the row and back, then off-stage for a minute or so. Clicking it plays a
 * one-shot chatter, the same "wake up the diorama" easter egg the other critters
 * each have their own version of.
 *
 * Under prefers-reduced-motion it simply hangs from the first tree, permanently
 * visible and entirely still.
 */
export function Monkey({ trees, prefersReducedMotion }: { trees: WorldPoint[]; prefersReducedMotion: boolean }) {
  const pivotRef = useRef<THREE.Group>(null);
  const swingRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const armRefs = useRef<(THREE.Group | null)[]>([]);
  const legRefs = useRef<(THREE.Group | null)[]>([]);
  const tailRefs = useRef<(THREE.Group | null)[]>([]);
  const yawRef = useRef<number | null>(null);

  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 1.4, minGap: 3, maxGap: 8, duration: 1.3 });
  const { visible, cycleId, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    fade: 1.2,
    firstDelay: 26,
    enabled: !prefersReducedMotion,
    restProgress: 0,
  });

  const anchors = useMemo<Anchor[]>(() => trees.map(getLimbAnchor), [trees]);
  /** Up the row and back down it, so an appearance ends where it started and the next one can start clean. */
  const route = useMemo(() => {
    const up = anchors.map((_, i) => i);
    return [...up, ...up.slice(0, -1).reverse()];
  }, [anchors]);

  const startHeading = useMemo(
    () => Math.atan2(anchors[1].x - anchors[0].x, anchors[1].z - anchors[0].z),
    [anchors],
  );

  // A fresh appearance starts at the near end facing up the row again, so the
  // yaw left over from the return trip must not be damped away in view.
  useEffect(() => {
    yawRef.current = null;
  }, [cycleId]);

  // Three shared materials, so fading the whole animal is three opacity writes.
  // The component stays mounted between appearances, so these live as long as
  // the map and need no manual disposal.
  const [coatMaterial, paleMaterial, faceMaterial] = useMemo(
    () =>
      [COAT_COLOR, PALE_COLOR, FACE_COLOR].map(
        (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, transparent: true }),
      ),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (prefersReducedMotion) return;
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime);
    const e = envelope();
    const { fade, progress } = sample();

    coatMaterial.opacity = fade;
    paleMaterial.opacity = fade;
    faceMaterial.opacity = fade;

    const hops = route.length - 1;
    // Clamped just inside the last hop so progress === 1 lands at its end rather than off the route.
    const along = Math.min(hops - 1e-6, Math.max(0, progress * hops));
    const hop = Math.floor(along);
    const u = along - hop;
    const from = anchors[route[hop]];
    const to = anchors[route[hop + 1]];
    const gap = Math.hypot(to.x - from.x, to.z - from.z);
    const heading = Math.atan2(to.x - from.x, to.z - from.z);

    // Shortest-way turn toward the direction of travel. This is also what keeps
    // the turnaround at the end of the row continuous: the catch happens on the
    // old heading, and the monkey then rotates around on the branch during the
    // wind-up rather than flipping in one frame.
    if (yawRef.current === null) yawRef.current = heading;
    else {
      const d = Math.atan2(Math.sin(heading - yawRef.current), Math.cos(heading - yawRef.current));
      yawRef.current += d * (1 - Math.exp(-YAW_LAMBDA * delta));
    }

    let theta: number;
    let airborne = 0;
    const pivot = pivotRef.current;
    const body = bodyRef.current;

    if (u < RELEASE_AT) {
      // Hanging: the pivot sits on the limb and the body swings under it, so the
      // arms stay on the branch without being animated into place.
      const p = u / RELEASE_AT;
      const amplitude = SWING_MAX * (CATCH_FRACTION + (1 - CATCH_FRACTION) * p);
      theta = -amplitude * Math.cos(Math.PI * SWING_HALF_CYCLES * p);
      if (pivot) pivot.position.set(from.x, from.y, from.z);
      if (body) body.position.y = -HANG_LEN;
    } else {
      // Airborne: the pivot *is* the body now, travelling a bowed line from the
      // release point to the catch point, both taken from the pendulum geometry.
      const v = (u - RELEASE_AT) / (1 - RELEASE_AT);
      airborne = Math.sin(Math.PI * v);
      const release = hangPoint(from, heading, SWING_MAX);
      const catchAt = hangPoint(to, heading, -CATCH_ANGLE);
      if (pivot) {
        pivot.position.set(
          release.x + (catchAt.x - release.x) * v,
          release.y + (catchAt.y - release.y) * v + airborne * ARC_FACTOR * gap,
          release.z + (catchAt.z - release.z) * v,
        );
      }
      if (body) body.position.y = 0;
      // Same angle it let go at, unwinding to the angle it will catch at, plus a
      // forward pitch over the top of the leap.
      theta = SWING_MAX + (-CATCH_ANGLE - SWING_MAX) * v + airborne * 0.6;
    }

    if (body) {
      body.position.y += e ? Math.sin(e.elapsed * 16) * 0.006 * e.strength : 0;
      // Shrinks a touch while faded, so it arrives and leaves the grove rather than materialising at full size.
      body.scale.setScalar(0.85 + 0.15 * fade);
    }
    if (pivot) pivot.rotation.y = yawRef.current;
    if (swingRef.current) {
      swingRef.current.rotation.x = -theta;
      swingRef.current.rotation.z = Math.sin(t * 0.8) * 0.06 + (e ? Math.sin(e.elapsed * 11) * 0.12 * e.strength : 0);
    }

    if (torsoRef.current) {
      // Same resting scale as the JSX below, plus the breath and the tuck it pulls into mid-leap.
      torsoRef.current.scale.set(
        0.76 + breath * 0.03,
        0.98 + breath * 0.04 - airborne * 0.06,
        0.66 + breath * 0.03,
      );
    }

    if (headRef.current) {
      headRef.current.rotation.y =
        Math.sin(t * 0.5) * 0.22 +
        Math.sin(fidgetElapsed * 2.6) * 0.4 * fidget +
        (e ? Math.sin(e.elapsed * 12) * 0.35 * e.strength : 0);
      // Looks where it is going on the way over, and down at the drop while hanging.
      headRef.current.rotation.x = Math.sin(t * 0.9) * 0.07 - airborne * 0.28 + 0.12 * fidget;
    }

    for (let i = 0; i < armRefs.current.length; i++) {
      const arm = armRefs.current[i];
      if (!arm) continue;
      const side = i === 0 ? -1 : 1;
      if (i === 0) {
        // The gripping arm: straight up onto the branch (-PI) for the whole
        // wind-up, dropping away as it lets go. Hanging by one arm rather than
        // two is what makes a silhouette this small read as a monkey instead of
        // a bear cub — and it frees the other arm to do something.
        arm.rotation.x = -Math.PI + airborne * 0.95 + (1 - airborne) * Math.sin(t * 1.6) * 0.04;
        arm.rotation.z = side * 0.06;
      } else {
        // The free arm: dangles and counter-swings while hanging, then throws
        // itself forward to grab the next limb over the top of the leap.
        arm.rotation.x = (1 - airborne) * (0.45 + Math.sin(t * 1.7 + 0.8) * 0.2 - theta * 0.5) + airborne * -2.1;
        arm.rotation.z = side * (0.22 + airborne * 0.22);
      }
    }

    for (let i = 0; i < legRefs.current.length; i++) {
      const leg = legRefs.current[i];
      if (!leg) continue;
      // Tucked up in the air, dangling and paddling a little while hanging.
      leg.rotation.x = airborne * 1.1 + (1 - airborne) * (Math.sin(t * 1.1 + i * 2.1) * 0.16 - theta * 0.25);
      leg.rotation.z = (i === 0 ? -1 : 1) * (0.1 + airborne * 0.12);
    }

    for (let i = 0; i < tailRefs.current.length; i++) {
      const tail = tailRefs.current[i];
      if (!tail) continue;
      tail.rotation.x =
        TAIL_REST[i] +
        Math.sin(t * 1.4 - i * 0.7) * 0.12 +
        // Streams out straight behind on the leap, and whips on a chatter.
        airborne * -0.45 +
        Math.sin(fidgetElapsed * 6 - i) * 0.14 * fidget +
        (e ? Math.sin(e.elapsed * 13 - i * 0.9) * 0.3 * e.strength : 0);
      tail.rotation.z = Math.sin(t * 0.9 - i * 0.5) * 0.1;
    }
  });

  if (!visible) return null;

  return (
    <group
      ref={pivotRef}
      position={[anchors[0].x, anchors[0].y, anchors[0].z]}
      rotation={[0, startHeading, 0]}
      scale={SCALE}
      onClick={(evt) => {
        evt.stopPropagation();
        trigger();
      }}
      onPointerOver={(evt) => {
        evt.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* Everything below hangs off the limb: this group is the pendulum arm. */}
      <group ref={swingRef} rotation={[CATCH_ANGLE, 0, 0]}>
        <group ref={bodyRef} position={[0, -HANG_LEN, 0]}>
          <mesh ref={torsoRef} scale={[0.76, 0.98, 0.66]} material={coatMaterial}>
            <sphereGeometry args={[0.023, 7, 6]} />
          </mesh>

          <mesh position={[0, -0.002, 0.013]} scale={[0.6, 0.7, 0.4]} material={paleMaterial}>
            <sphereGeometry args={[0.017, 6, 5]} />
          </mesh>

          {/* Head, ruff, face and ears share a pivot at the neck so a look-around
              carries all four. Set forward of the shoulders rather than between
              them, or the raised arms swallow it from above. */}
          <group ref={headRef} position={[0, 0.028, 0.012]}>
            <mesh material={coatMaterial}>
              <sphereGeometry args={[0.016, 7, 6]} />
            </mesh>
            {/* The whisker ruff is what makes a head this small still read as a langur from above. */}
            <mesh position={[0, -0.001, 0.006]} scale={[1, 0.95, 0.4]} material={paleMaterial}>
              <sphereGeometry args={[0.017, 7, 6]} />
            </mesh>
            <mesh position={[0, -0.001, 0.013]} scale={[0.9, 0.95, 0.5]} material={faceMaterial}>
              <sphereGeometry args={[0.011, 6, 5]} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.015, 0.004, -0.002]} material={coatMaterial}>
                <sphereGeometry args={[0.005, 5, 4]} />
              </mesh>
            ))}
          </group>

          {/* Arms hang from shoulder pivots, so reaching up to the branch is one rotation of the whole arm. */}
          {[-1, 1].map((side, i) => (
            <group
              key={side}
              ref={(g) => {
                armRefs.current[i] = g;
              }}
              position={[side * 0.016, 0.016, 0]}
              rotation={[-Math.PI, 0, side * 0.06]}
            >
              <mesh position={[0, -0.015, 0]} material={coatMaterial}>
                <cylinderGeometry args={[0.004, 0.0048, 0.03, 5]} />
              </mesh>
              <mesh position={[0, -0.032, 0]} material={coatMaterial}>
                <sphereGeometry args={[0.0055, 5, 4]} />
              </mesh>
            </group>
          ))}

          {[-1, 1].map((side, i) => (
            <group
              key={side}
              ref={(g) => {
                legRefs.current[i] = g;
              }}
              position={[side * 0.011, -0.017, 0.002]}
              rotation={[0, 0, side * 0.1]}
            >
              <mesh position={[0, -0.011, 0]} material={coatMaterial}>
                <cylinderGeometry args={[0.0045, 0.0055, 0.022, 5]} />
              </mesh>
              <mesh position={[0, -0.023, 0.003]} scale={[0.8, 0.6, 1.2]} material={coatMaterial}>
                <sphereGeometry args={[0.006, 5, 4]} />
              </mesh>
            </group>
          ))}

          {/* Three nested segments: a langur's tail is longer than the rest of it, and one straight cylinder that long reads as a stick. */}
          <group
            ref={(g) => {
              tailRefs.current[0] = g;
            }}
            position={[0, -0.011, -0.018]}
            rotation={[TAIL_REST[0], 0, 0]}
          >
            <mesh position={[0, -0.017, 0]} material={coatMaterial}>
              <cylinderGeometry args={[0.0036, 0.0046, 0.034, 5]} />
            </mesh>
            <group
              ref={(g) => {
                tailRefs.current[1] = g;
              }}
              position={[0, -0.034, 0]}
              rotation={[TAIL_REST[1], 0, 0]}
            >
              <mesh position={[0, -0.016, 0]} material={coatMaterial}>
                <cylinderGeometry args={[0.003, 0.0036, 0.032, 5]} />
              </mesh>
              <group
                ref={(g) => {
                  tailRefs.current[2] = g;
                }}
                position={[0, -0.032, 0]}
                rotation={[TAIL_REST[2], 0, 0]}
              >
                {/* Coat-coloured, not pale. A real langur's tail does end lighter,
                    but at this size the bright ruff tone turned the last segment
                    into a white stick that read as a twig rather than a tail. */}
                <mesh position={[0, -0.014, 0]} material={coatMaterial}>
                  <cylinderGeometry args={[0.0022, 0.003, 0.028, 5]} />
                </mesh>
              </group>
            </group>
          </group>

          {reacting && (
            <Html position={[0, 0.075, 0.02]} center zIndexRange={CRITTER_HTML_Z}>
              <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
                Hoepla! 🐒
              </div>
            </Html>
          )}
        </group>
      </group>
    </group>
  );
}
