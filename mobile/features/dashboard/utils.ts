import type { TFunction } from "i18next";

import type { SessionDto } from "../../types/session";

export function parseApiDate(value: string) {
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

export function formatTimer(totalSeconds: number) {
  const s = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? Math.floor(totalSeconds) : 0;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatNaturalCounting(totalSeconds: number, t: TFunction): string {
  const s = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? totalSeconds : 0;
  const mins = Math.floor(s / 60);
  if (mins < 1) return t("dashboard.naturalCountingStart");
  return t("dashboard.naturalCountingMins", { count: mins, mins });
}

export function notesPreview(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const trimmed = notes.trim();
  if (trimmed.length <= 50) return trimmed;
  return `${trimmed.slice(0, 50)}…`;
}

export function toDateKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getStreak(sessions: SessionDto[]) {
  const dayKeys = Array.from(
    new Set(
      sessions
        .map((session) => {
          if (!session.started_at?.trim()) return null;
          const d = parseApiDate(session.started_at);
          return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
        })
        .filter((k): k is string => k !== null),
    ),
  ).sort();
  if (dayKeys.length === 0) return 0;
  const set = new Set(dayKeys);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(toDateKey(cursor))) return 0;
  }
  while (set.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getLast7DaysProgress(sessions: SessionDto[]) {
  const set = new Set(
    sessions
      .map((session) => {
        if (!session.started_at?.trim()) return null;
        const d = parseApiDate(session.started_at);
        return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
      })
      .filter((k): k is string => k !== null),
  );
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(set.has(toDateKey(d)));
  }
  return result;
}
