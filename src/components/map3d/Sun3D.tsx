import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SKY_GLOW_GLSL, SUN_DIR, SUN_GLOW_DAY, SUN_GLOW_NIGHT } from "./sky";

/** Inside the camera's far plane (100), and further out than anything else in the scene, so the island and sea always depth-test in front of it. */
const SKY_RADIUS = 80;

/** Angular radius of the disc. A real sun is ~0.27°; this is a diorama sun, sized to read at a glance once it is in frame. */
const DISC_RADIUS_DEG = 2.4;

const SUN_CORE = new THREE.Color("#fff3d1");
/** By night the same disc reads as the moon. */
const MOON_CORE = new THREE.Color("#e6ecff");

function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_DIR },
      uCore: { value: SUN_CORE.clone() },
      uGlow: { value: SUN_GLOW_DAY.clone() },
      uDiscCos: { value: Math.cos(THREE.MathUtils.degToRad(DISC_RADIUS_DEG)) },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uCore;
      uniform vec3 uGlow;
      uniform float uDiscCos;
      uniform float uNight;
      varying vec3 vDir;

      ${SKY_GLOW_GLSL}

      void main() {
        vec3 dir = normalize(vDir);
        float c = dot(dir, uSunDir);

        // The sea's far edge hazes into the backdrop well below eye level, so
        // between there and the horizon nothing hides the lower half of the
        // disc. This does it instead: the disc dissolves into the haze as it
        // nears the horizon, which is what makes the sun sit *on* the sea
        // rather than hang in front of it. The glow is left alone; Water hazes
        // into the same glow below the horizon.
        float aboveHorizon = smoothstep(-0.004, 0.035, dir.y);

        // Disc with a soft limb, warmer the lower it sits.
        float disc = smoothstep(uDiscCos - 0.00035, uDiscCos + 0.00025, c) * aboveHorizon;
        vec3 core = mix(uGlow, uCore, smoothstep(0.0, 0.05, dir.y));

        vec3 color = core * disc + uGlow * skyGlow(dir) * (1.0 - disc);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * The sun on the horizon, behind the island as seen from the default camera (see SUN_DIR).
 *
 * A camera-centred sky sphere rather than an object somewhere in the world: a
 * sun at any finite distance would sit *below* eye level for a camera ten units
 * up, and drift as the camera orbits. Re-centred on the camera right before it
 * draws, it behaves as if infinitely far away and stays pinned to the horizon
 * from every angle. Drawn additively over the flat scene background, so the
 * backdrop colour the sea's haze is matched to stays untouched wherever the
 * glow isn't.
 *
 * With the default framing the horizon is above the top of the frame, so the
 * disc only comes into view when the map is tilted down — deliberately, so the
 * overview stays a map rather than a sunset. What the overview does get is the
 * glow: the far sea hazes into skyGlow (sky.ts) and warms faintly towards the
 * sun. The glitter track on the water comes from Water's reflected sky, which
 * uses the same SUN_DIR.
 */
export function Sun3D({ nightRef }: { nightRef: RefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(createSkyMaterial, []);

  useFrame(() => {
    const t = nightRef.current;
    (material.uniforms.uCore.value as THREE.Color).copy(SUN_CORE).lerp(MOON_CORE, t);
    (material.uniforms.uGlow.value as THREE.Color).copy(SUN_GLOW_DAY).lerp(SUN_GLOW_NIGHT, t);
    material.uniforms.uNight.value = t;
  });

  return (
    <mesh
      ref={meshRef}
      material={material}
      renderOrder={2}
      frustumCulled={false}
      // Here rather than in useFrame: CameraControls moves the camera in its own
      // useFrame, and following it a frame late makes the horizon visibly swim.
      onBeforeRender={(_renderer, _scene, camera) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        mesh.position.copy(camera.position);
        mesh.updateMatrixWorld();
      }}
    >
      <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
    </mesh>
  );
}
