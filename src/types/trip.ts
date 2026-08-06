export type TransportModeKey = "car" | "train" | "tuktuk";

export interface TransportMode {
  label: string;
  icon: string;
  color: string;
  style: "solid" | "dashed";
}

export interface Flight {
  airline: string;
  via: string;
  date: string;
  from: string;
  depart: string;
  to: string;
  arrive: string;
  duration: string;
  booked: boolean;
}

export interface BookingSummary {
  booked: string;
  toBook: string;
}

export interface Trip {
  title: string;
  start: string;
  end: string;
  totalNights: number;
  flights: {
    outbound: Flight;
    return: Flight;
  };
  bookingSummary: BookingSummary;
}

/** Site-relative /public path or external URL. No upload pipeline. */
export type PhotoUrl = string;

export interface Accommodation {
  name: string;
  url?: string;
  photos?: PhotoUrl[];
  note?: string;
}

/** How keen we are on an activity, shown as a small label on its card. Purely a planning aid — adjust freely per activity. */
export type ActivityPriority = "must" | "nice" | "maybe";

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
}

export interface TransportLeg {
  mode: TransportModeKey;
  label: string;
  duration: string;
  warn?: string;
}

export interface Stop {
  /** Stable hand-authored slug. Never reuse or change once set; display order is derived from array position. */
  id: string;
  name: string;
  dates: string;
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
  activities: Activity[];
}
