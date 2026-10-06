import type { TFunction } from "i18next";

import { localDateKey, parseIsoDate, startOfWeekMonday } from "../../../lib/weekCalendar";
import type { BarPoint, DecoratedRecord, StatsPeriod } from "../types";
import { isMonthBarLabel } from "./chartScale";
import { recordTitle } from "./records";

export type ChartRecordMark = {
  barLabel: string;
  record: DecoratedRecord;
};

const DAY_RECORD_KEYS = new Set(["most_hours_day", "most_sessions_day", "longest_session"]);
const WEEK_RECORD_KEYS = new Set(["productive_week"]);

const MARK_PRIORITY: Record<string, number> = {
  productive_week: 30,
  most_hours_day: 20,
  most_sessions_day: 20,
  longest_session: 10,
};

export function chartRecordMarks(
  bars: BarPoint[],
  records: DecoratedRecord[],
  period: StatsPeriod,
): ChartRecordMark[] {
  const visible = new Set(bars.map((bar) => bar.label));
  const chosen = new Map<string, DecoratedRecord>();

  for (const record of records) {
    const barLabel = barLabelForRecord(record, period, bars);
    if (!barLabel || !visible.has(barLabel)) continue;
    const current = chosen.get(barLabel);
    if (!current || markPriority(record.key) > markPriority(current.key)) {
      chosen.set(barLabel, record);
    }
  }

  return [...chosen.entries()].map(([barLabel, record]) => ({ barLabel, record }));
}

export function chartRecordCaption(record: DecoratedRecord, t: TFunction): string {
  return `${recordTitle(record.key, record.label, t)} · ${record.value}`;
}

function barLabelForRecord(
  record: DecoratedRecord,
  period: StatsPeriod,
  bars: BarPoint[],
): string | null {
  const dayKey = calendarDayKey(record.occurred_at);
  if (!dayKey) return null;

  if (period === "all") {
    if (bars.some((bar) => isMonthBarLabel(bar.label))) return dayKey.slice(0, 7);
    if (WEEK_RECORD_KEYS.has(record.key)) return dayKey;
    if (DAY_RECORD_KEYS.has(record.key)) {
      return localDateKey(startOfWeekMonday(parseIsoDate(dayKey)));
    }
    return null;
  }

  return DAY_RECORD_KEYS.has(record.key) ? dayKey : null;
}

function calendarDayKey(occurredAt: string | null): string | null {
  if (!occurredAt) return null;
  const dayKey = occurredAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : null;
}

function markPriority(key: string): number {
  return MARK_PRIORITY[key] ?? 0;
}
