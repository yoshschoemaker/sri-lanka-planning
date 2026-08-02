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

export interface Activity {
  name: string;
  dist: string;
  daytrip?: boolean;
}

export interface TransportLeg {
  mode: TransportModeKey;
  label: string;
  duration: string;
  warn?: string;
}

export interface Stop {
  n: number;
  name: string;
  dates: string;
  nights: number;
  booked: boolean;
  warn?: string;
  lat: number;
  lon: number;
  transportTo: TransportLeg;
  note: string;
  activities: Activity[];
}

export interface Daytrip {
  name: string;
  from: string;
  lat: number;
  lon: number;
  note: string;
}
