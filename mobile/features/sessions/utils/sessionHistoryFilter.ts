import { currentWeekDateKeys, localDateKey } from "../../../lib/weekCalendar";
import type { StatsPeriod } from "../../stats/types";
import type { SessionDto } from "../../../types/session";

export function filterCompletedSessions(sessions: SessionDto[]): SessionDto[] {
  return sessions.filter((session) => session.stopped_at !== null);
}

export function filterSessionsByStatsPeriod(
  sessions: SessionDto[],
  period: StatsPeriod | null | undefined,
  now = new Date(),
): SessionDto[] {
  const completed = filterCompletedSessions(sessions);
  if (!period || period === "all") return completed;
  if (period === "week") {
    const week = new Set(currentWeekDateKeys(now));
    return completed.filter((session) => {
      const started = new Date(session.started_at);
      return !Number.isNaN(started.getTime()) && week.has(localDateKey(started));
    });
  }

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 29);

  return completed.filter((session) => {
    const started = new Date(session.started_at);
    return !Number.isNaN(started.getTime()) && started.getTime() >= cutoff.getTime();
  });
}
