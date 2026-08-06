export interface Region {
  id: string;
  name: string;
  /** Inclusive range of the derived display-order number (i + 1), not stop.id. */
  orderStart: number;
  orderEnd: number;
}

export const regions: Region[] = [
  { id: "cultural-triangle", name: "Culturele Driehoek", orderStart: 2, orderEnd: 3 },
  { id: "hill-country", name: "Bergland & thee", orderStart: 4, orderEnd: 5 },
  { id: "south-coast", name: "Zuidkust & wildlife", orderStart: 6, orderEnd: 9 },
];

export function getRegionForStop(order: number): Region | undefined {
  return regions.find((region) => order >= region.orderStart && order <= region.orderEnd);
}
