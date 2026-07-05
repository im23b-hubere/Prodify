import type { TFunction } from "i18next";

import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { STATS_RECORD_FRESH_MS } from "../constants";
import type { DecoratedRecord, PersonalRecord } from "../types";

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRecordDate(value: string | null, t: (key: string) => string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${t("stats.recordAchieved")} ${date.toLocaleDateString()}`;
}

export function formatRecordContext(record: PersonalRecord, t: TFunction) {
  if (!record.context) return null;
  if (record.key === "longest_session") {
    return sessionTypeLabel(record.context, t);
  }
  if (record.key === "most_sessions_day") {
    const date = new Date(record.context);
    return Number.isNaN(date.getTime())
      ? record.context
      : t("stats.recordOnDate", { date: date.toLocaleDateString() });
  }
  if (record.key === "productive_week") {
    const rawDate = record.context.replace("Week of ", "").trim();
    const date = new Date(rawDate);
    return Number.isNaN(date.getTime())
      ? record.context
      : t("stats.recordWeekOf", { date: date.toLocaleDateString() });
  }
  if (record.context === "Now") return t("stats.recordNow");
  if (record.context === "All-time") return t("stats.recordAllTime");
  return record.context;
}

export function recordTitle(key: string, fallback: string, t: TFunction) {
  if (key === "longest_session") return t("stats.recordLongestSession");
  if (key === "most_sessions_day") return t("stats.recordMostSessionsDay");
  if (key === "longest_streak") return t("stats.recordLongestStreak");
  if (key === "current_streak") return t("stats.recordCurrentStreak");
  if (key === "productive_week") return t("stats.recordProductiveWeek");
  return fallback;
}

function recordPriorityScore(key: string) {
  if (key === "current_streak") return 100;
  if (key === "longest_streak") return 90;
  if (key === "productive_week") return 80;
  if (key === "most_sessions_day") return 70;
  if (key === "longest_session") return 60;
  return 20;
}

export function decorateRecords(records: PersonalRecord[], now = Date.now()): DecoratedRecord[] {
  return records
    .map((record) => {
      const occurredDate = parseIsoDate(record.occurred_at);
      const isFresh = occurredDate ? now - occurredDate.getTime() <= STATS_RECORD_FRESH_MS : false;
      return {
        ...record,
        score: recordPriorityScore(record.key) + (isFresh ? 1000 : 0),
        isFresh,
      };
    })
    .sort((a, b) => b.score - a.score);
}
