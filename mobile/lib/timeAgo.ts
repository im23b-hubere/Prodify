import type { TFunction } from "i18next";

export function formatTimeAgo(
  iso: string,
  t: TFunction,
  unknownKey = "friendsScreen.unknownTime",
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return t(unknownKey);
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("friendsWidget.agoNow");
  if (mins < 60) return t("friendsWidget.agoMinutes", { mins });
  const hours = Math.floor(mins / 60);
  if (hours < 48) return t("friendsWidget.agoHours", { hours });
  const days = Math.floor(hours / 24);
  return t("friendsWidget.agoDays", { days });
}
