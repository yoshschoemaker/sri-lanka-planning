import { Fragment } from "react";
import type { Stop, TransportMode, TransportModeKey } from "../types/trip";
import { StopCard } from "./StopCard";
import { TransportConnector } from "./TransportConnector";
import { RegionHeader } from "./RegionHeader";
import { getRegion } from "../data/tripContent";
import { isBookingSettled } from "../utils/nights";
import type { ModeFilter, PriorityFilter, StatusFilter } from "./FilterBar";

interface ItineraryListProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  /** Id's van de stops die vandaag zijn; leeg zolang de reis niet loopt. */
  todayIds: string[];
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
  priorityFilter: PriorityFilter;
}

export function ItineraryList({
  stops,
  transportModes,
  selected,
  todayIds,
  onSelect,
  registerRef,
  statusFilter,
  modeFilter,
  priorityFilter,
}: ItineraryListProps) {
  return (
    <ol className="flex flex-col gap-0">
      {stops.map((stop, i) => {
        const order = i + 1;
        const mode = transportModes[stop.transportTo.mode];
        const statusDimmed = statusFilter === "toBook" && isBookingSettled(stop);
        const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
        const region = getRegion(stop.region);
        const previousRegion = i > 0 ? getRegion(stops[i - 1].region) : undefined;

        return (
          <Fragment key={stop.id}>
            {/*
              Regiokop en reisetappe stonden hier als losse div's rechtstreeks
              onder de <ol>, wat ongeldige lijst-opmaak is: een lijst mag alleen
              <li> als direct kind hebben, en een schermlezer verliest daardoor
              de telling van de route. RegionHeader rendert nu zelf een <li>, en
              de etappe verhuist naar de <li> van de stop waar hij naartoe leidt.
              Dat laatste klopt ook inhoudelijk: het is stop.transportTo, dus
              "hoe je hier komt" hoort bij deze stop.
            */}
            {region && region.id !== previousRegion?.id && <RegionHeader region={region} />}
            <li className="list-none">
              {i > 0 && (
                <TransportConnector
                  leg={stop.transportTo}
                  mode={mode}
                  dimmed={modeFilter !== "all" && modeFilter !== stop.transportTo.mode}
                />
              )}
              <StopCard
                stop={stop}
                order={order}
                mode={mode}
                isActive={selected === stop.id}
                isToday={todayIds.includes(stop.id)}
                dimmed={statusDimmed || modeDimmed}
                priorityFilter={priorityFilter}
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
