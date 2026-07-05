import type { StatsPeriod } from "../../stats/types";
import type { SessionDto } from "../../../types/session";

export function filterCompletedSessions(sessions: SessionDto[]): SessionDto[] {
  return sessions.filter((session) => session.stopped_at !== null);
}

export function filterSessionsByStatsPeriod(
  sessions: SessionDto[],
  period: StatsPeriod | null | undefined,
): SessionDto[] {
  const completed = filterCompletedSessions(sessions);
  if (!period || period === "all") return completed;

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (period === "week") {
    cutoff.setDate(cutoff.getDate() - 6);
  } else if (period === "month") {
    cutoff.setDate(cutoff.getDate() - 29);
  }

  return completed.filter((session) => {
    const started = new Date(session.started_at);
    return !Number.isNaN(started.getTime()) && started.getTime() >= cutoff.getTime();
  });
}
