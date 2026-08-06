import { Fragment } from "react";
import type { Stop, TransportMode, TransportModeKey } from "../types/trip";
import { StopCard } from "./StopCard";
import { TransportConnector } from "./TransportConnector";
import { RegionHeader } from "./RegionHeader";
import { getRegionForStop } from "../data/regions";
import type { ModeFilter, StatusFilter } from "./FilterBar";

interface ItineraryListProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
}

export function ItineraryList({
  stops,
  transportModes,
  selected,
  onSelect,
  registerRef,
  statusFilter,
  modeFilter,
}: ItineraryListProps) {
  return (
    <ol className="flex flex-col gap-0">
      {stops.map((stop, i) => {
        const order = i + 1;
        const mode = transportModes[stop.transportTo.mode];
        const statusDimmed = statusFilter === "toBook" && stop.booked;
        const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
        const region = getRegionForStop(order);
        const previousRegion = i > 0 ? getRegionForStop(order - 1) : undefined;

        return (
          <Fragment key={stop.id}>
            {region && region.id !== previousRegion?.id && <RegionHeader region={region} />}
            {i > 0 && (
              <TransportConnector
                leg={stop.transportTo}
                mode={mode}
                dimmed={modeFilter !== "all" && modeFilter !== stop.transportTo.mode}
              />
            )}
            <li className="list-none">
              <StopCard
                stop={stop}
                order={order}
                mode={mode}
                isActive={selected === stop.id}
                dimmed={statusDimmed || modeDimmed}
                onSelect={onSelect}
                registerRef={registerRef}
              />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
