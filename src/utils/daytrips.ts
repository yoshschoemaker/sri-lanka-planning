import type { Activity, Stop } from "../types/trip";

export type DaytripActivity = Activity & { lat: number; lon: number };

export function isDaytripActivity(activity: Activity): activity is DaytripActivity {
  return Boolean(activity.daytrip) && activity.lat != null && activity.lon != null;
}

export interface DaytripEntry {
  stop: Stop;
  activity: DaytripActivity;
}

export function getDaytripEntries(stops: Stop[]): DaytripEntry[] {
  return stops.flatMap((stop) =>
    stop.activities.filter(isDaytripActivity).map((activity) => ({ stop, activity }))
  );
}
