const clockFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "short",
});

export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? clockFormatter.format(date) : "";
}

export function formatActivityDay(date: Date): string {
  return dayFormatter.format(date);
}
