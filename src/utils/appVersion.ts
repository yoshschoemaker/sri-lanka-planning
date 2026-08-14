/** Buildinfo voor het instellingenpaneel. Zie `define` in vite.config.ts. */

export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILD_TIME = __APP_BUILD_TIME__;

const buildFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });

const dateTimeFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatBuildTime(): string {
  const date = new Date(APP_BUILD_TIME);
  if (Number.isNaN(date.getTime())) return "onbekend";
  return buildFormat.format(date);
}

/** "vandaag om 14:05" zolang het dezelfde dag is, anders datum plus tijd. */
export function formatCheckTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay ? `vandaag om ${timeFormat.format(date)}` : dateTimeFormat.format(date);
}
