import { Component, Suspense, lazy, type ReactNode } from "react";
import type { Stop, TransportMode, TransportModeKey } from "../types/trip";
import type { ModeFilter, StatusFilter } from "./FilterBar";
import { TripMap } from "./TripMap";
import { MapSkeleton } from "./map3d/MapSkeleton";

export type TripMapVariant = "hero" | "panel";

export interface TripMapSceneProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Only used by the 3D scene's own tour, which advances `selected` itself — kept distinct from onSelect so a mobile caller can skip onSelect's scroll-into-view for those automated changes (see App.tsx's handleTourSelect). No-op for the 2D fallback, which has no tour. */
  onTourSelect: (id: string) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
  variant?: TripMapVariant;
  /** Stops the 3D scene's render loop (no-op for the 2D fallback, which has no continuous loop to begin with) — for instances kept mounted but hidden, e.g. the inline mobile map behind MapModal, so two live WebGL scenes never run at once. */
  paused?: boolean;
}

const TripMap3D = lazy(() =>
  import("./map3d/TripMap3D").then((module) => ({ default: module.TripMap3D })),
);

/** Synchronous, one-time check: no WebGL2 means never attempt the 3D tree. */
function detectWebGL2Support(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

const webglSupported = detectWebGL2Support();

interface MapErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches runtime crashes anywhere in the 3D tree (geometry bugs, lost WebGL
 * context, driver quirks) so a broken scene degrades to the 2D map instead of
 * taking down the page.
 */
class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D map crashed, falling back to 2D map:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const PANEL_FRAME_CLASS =
  "rounded-3xl border border-ink/10 bg-white/50 aspect-[3/4] max-w-md mx-auto overflow-hidden";
const HERO_FRAME_CLASS = "h-full w-full";

/**
 * Orchestrates the 3D map with a same-shape fallback to the 2D `TripMap`.
 * Both failure paths (no WebGL2, or a runtime crash once mounted) render the
 * existing 2D map with identical props, so there is never a broken or empty
 * map. The 3D tree itself is code-split via `React.lazy` so three/fiber/drei
 * never end up in the main bundle.
 */
export function TripMapScene({ variant = "panel", paused = false, ...mapProps }: TripMapSceneProps) {
  if (!webglSupported) {
    return <TripMap {...mapProps} />;
  }

  return (
    <MapErrorBoundary fallback={<TripMap {...mapProps} />}>
      <div className={variant === "hero" ? HERO_FRAME_CLASS : PANEL_FRAME_CLASS}>
        <Suspense fallback={<MapSkeleton />}>
          <TripMap3D paused={paused} {...mapProps} />
        </Suspense>
      </div>
    </MapErrorBoundary>
  );
}
