import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/** Seconds between sweeps. Props come and go (birds, the tour's vehicle, appearance cycles), so one pass at mount isn't enough, but nothing needs it the same frame. */
const SWEEP_INTERVAL = 0.5;

function isStandard(material: THREE.Material | THREE.Material[]): boolean {
  const list = Array.isArray(material) ? material : [material];
  return list.every((m) => m instanceof THREE.MeshStandardMaterial);
}

function isTransparent(material: THREE.Material | THREE.Material[]): boolean {
  const list = Array.isArray(material) ? material : [material];
  return list.some((m) => m.transparent && m.opacity < 1);
}

/**
 * Opts every lit mesh in the scene into the key light's shadows, instead of
 * threading castShadow/receiveShadow through some forty prop components.
 *
 * Only meshStandardMaterial counts: the sea, inland water and route lines are
 * raw shader materials with no shadow chunks (and the sea's own reflections
 * already do that job), and basic materials are unlit glows. Faded-out meshes
 * still receive but don't cast, so a dimmed marker or a prop mid-fade doesn't
 * drop a fully solid shadow. Anything can opt out with `userData.noShadow`.
 *
 * Swaying vegetation casts the shadow of its rest pose — the sway lives in an
 * onBeforeCompile patch the depth pass never sees. At these amplitudes that is
 * invisible, and keeping the shadows still is arguably calmer anyway.
 */
export function ShadowCasting() {
  const elapsed = useRef(SWEEP_INTERVAL);

  useFrame((state, delta) => {
    elapsed.current += delta;
    if (elapsed.current < SWEEP_INTERVAL) return;
    elapsed.current = 0;

    state.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.noShadow) return;
      if (!isStandard(object.material)) return;
      object.receiveShadow = true;
      object.castShadow = !isTransparent(object.material);
    });
  });

  return null;
}
