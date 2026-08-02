import { Fragment } from "react";
import type { Stop, TransportMode, TransportModeKey } from "../types/trip";
import { StopCard } from "./StopCard";
import { TransportConnector } from "./TransportConnector";
import type { ModeFilter, StatusFilter } from "./FilterBar";

interface ItineraryListProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: number | null;
  onSelect: (n: number) => void;
  registerRef: (n: number, el: HTMLDivElement | null) => void;
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
        const mode = transportModes[stop.transportTo.mode];
        const statusDimmed = statusFilter === "toBook" && stop.booked;
        const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;

        return (
          <Fragment key={stop.n}>
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
                mode={mode}
                isActive={selected === stop.n}
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
