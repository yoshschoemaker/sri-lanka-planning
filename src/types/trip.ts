/**
 * The shapes the app renders. Everything here is produced by
 * src/data/tripContent.ts out of content/trip.json — nothing in src/ is meant
 * to be edited to change the trip itself.
 *
 * Note which fields are *derived*: dates, totalNights and bookingSummary are
 * computed from the two flights plus each stop's `nights`, so they can never
 * drift out of sync with the plan. They are not in the JSON.
 */

/**
 * A key of content/trip.json's `transportModes`. A plain string rather than a
 * fixed union so a new mode is a JSON edit — the map, legend and filter bar all
 * build themselves from whatever keys are in there. Two modes are special-cased
 * in the 3D scene ("train" gets a locomotive, "car"/"tuktuk" get a road
 * vehicle); anything else simply gets a line without a vehicle.
 */
export type TransportModeKey = string;

export interface TransportMode {
  label: string;
  icon: string;
  color: string;
  style: "solid" | "dashed";
}

export interface Flight {
  airline: string;
  via?: string;
  from: string;
  to: string;
  /** Local departure time as authored, e.g. "2027-01-25T11:45". */
  departAt: string;
  /** Local arrival time at the destination, e.g. "2027-01-26T06:10". */
  arriveAt: string;
  /** As the airline states it — the two timestamps are in different time zones, so this is not derived. */
  duration: string;
  booked: boolean;
  /** Derived display string, e.g. "ma 25 jan". */
  date: string;
  /** Derived display string, e.g. "11:45". */
  depart: string;
  /** Derived display string, e.g. "26 jan 06:10". */
  arrive: string;
}

export interface BookingSummary {
  booked: string;
  toBook: string;
}

export interface Trip {
  title: string;
  /** Derived: the outbound flight's departure date (ISO, date only). */
  start: string;
  /** Derived: the return flight's arrival date (ISO, date only). */
  end: string;
  /** Derived: the outbound flight's arrival date — day 1 on the island, and the first stop's check-in. */
  itineraryStart: string;
  /**
   * Derived: nights the flights leave room for, i.e. from landing to the return
   * flight's departure. What the stops *actually* plan is their `nights` summed;
   * computeNightsCheck compares the two.
   */
  totalNights: number;
  flights: {
    outbound: Flight;
    return: Flight;
  };
  /** Derived from the flights' and stops' booked flags. */
  bookingSummary: BookingSummary;
}

/** Site-relative /public path or external URL. No upload pipeline. */
export type PhotoUrl = string;

export interface Accommodation {
  name: string;
  url?: string;
  /** Google Maps link to the accommodation. */
  mapsUrl?: string;
  photos?: PhotoUrl[];
  note?: string;
}

/** How keen we are on an activity, shown as a small label on its card. Purely a planning aid — adjust freely per activity. */
export type ActivityPriority = "must" | "nice" | "maybe";

/** Optional hand corrections for a daytrip's label on the 3D map. */
export interface ActivityMapOverrides {
  /** Sideways nudge in px. Negative moves it left. Only needed when a label overlaps a neighbouring pin. */
  labelOffset3d?: number;
}

export interface Activity {
  /** Stable hand-authored slug. Never reuse or change once set. */
  id: string;
  name: string;
  dist: string;
  description?: string;
  photos?: PhotoUrl[];
  /** True when this activity also gets its own marker + line on the map. */
  daytrip?: boolean;
  /** Required in practice when daytrip is true. */
  lat?: number;
  lon?: number;
  /** Absent when it's not really a "pick one" activity (e.g. a flight entry). */
  priority?: ActivityPriority;
  map?: ActivityMapOverrides;
}

export interface TransportLeg {
  mode: TransportModeKey;
  label: string;
  duration: string;
  warn?: string;
}

export type LabelAnchor = "start" | "middle" | "end";
export type LabelDirection = "left" | "right";

/**
 * Optional hand corrections for one stop's placement on the two maps. Only
 * needed where markers or labels would collide — everything else falls back to
 * the projection of lat/lon and a default label position.
 */
export interface StopMapOverrides {
  /** Marker offset on the flat map, in SVG px. */
  nudge2d?: { dx: number; dy: number };
  /** Name-label position on the flat map. Default sits to the right of the marker. */
  label2d?: { dx: number; dy: number; anchor: LabelAnchor };
  /** Marker offset on the 3D map, in world units (x = east, z = south). */
  nudge3d?: { dx: number; dz: number };
  /** Which way the expanded 3D label opens. Default "right". */
  label3d?: LabelDirection;
}

export interface Stop {
  /** Stable hand-authored slug. Never reuse or change once set; display order is derived from array position. */
  id: string;
  name: string;
  /** Id of an entry in content/trip.json's `regions`, or absent for a stop that sits under no heading. */
  region?: string;
  /**
   * Derived from the flights and the preceding stops' nights: check-in to
   * check-out, the way you'd fill in a booking ("wo 27 tot vr 29 jan"). The end
   * date is the departure day, not the last night, and coincides with the next
   * stop's check-in. A stopover (0 nights) names a single day.
   */
  dates: string;
  /** Derived check-in date (ISO, date only). */
  startDate: string;
  /** Derived check-out date (ISO, date only). Equals startDate for a stopover. */
  endDate: string;
  nights: number;
  booked: boolean;
  warn?: string;
  lat: number;
  lon: number;
  transportTo: TransportLeg;
  note: string;
  /** Absent while no specific place has been chosen/booked yet. */
  accommodation?: Accommodation;
  photos?: PhotoUrl[];
  map?: StopMapOverrides;
  activities: Activity[];
}

export interface Region {
  id: string;
  name: string;
}
