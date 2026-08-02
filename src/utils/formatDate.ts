export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const day = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });
  const year = endDate.getFullYear();
  return `${day.format(startDate)} – ${day.format(endDate)} ${year}`;
}
