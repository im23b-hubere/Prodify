import type { TFunction } from "i18next";

import { API_BASE_URL } from "../../constants/api";

export function parseProfileUserId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const userId = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export function profilePictureUrl(path: string | null | undefined): string | null {
  const normalized = path?.trim();
  if (!normalized) return null;
  return normalized.startsWith("http") ? normalized : `${API_BASE_URL}${normalized}`;
}

export function translatedWeekday(day: string | null | undefined, t: TFunction): string | null {
  if (!day?.trim()) return null;
  const normalized = day.trim();
  const key = `friendProfile.weekdays.${normalized.toLowerCase()}`;
  const translated = t(key, { defaultValue: "" });
  return translated && translated !== key ? translated : normalized;
}
