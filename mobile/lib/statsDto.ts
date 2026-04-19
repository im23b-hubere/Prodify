import type { SessionStatsDto } from "../types/session";
import { parseSessionList } from "./sessionDto";

function finiteNonNeg(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  if (!Number.isFinite(v) || v < 0) return fallback;
  return v;
}

function finiteNumber(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Normalizes `/sessions/stats` JSON so charts and summaries never see NaN or non-arrays.
 * Returns null only when the payload is not an object at all.
 */
export function tryParseSessionStatsDto(value: unknown): SessionStatsDto | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const rawSummary = v.summary;
  const summaryObj =
    rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
      ? (rawSummary as Record<string, unknown>)
      : {};

  const total_sessions = Math.floor(finiteNonNeg(summaryObj.total_sessions, 0));
  const total_seconds = finiteNonNeg(summaryObj.total_seconds, 0);
  const avg_session_seconds =
    total_sessions > 0
      ? Math.floor(finiteNonNeg(summaryObj.avg_session_seconds, total_seconds / total_sessions))
      : 0;

  const summary = {
    total_seconds,
    total_sessions,
    best_streak_days: Math.floor(finiteNonNeg(summaryObj.best_streak_days, 0)),
    avg_session_seconds,
    current_streak_days: Math.floor(finiteNonNeg(summaryObj.current_streak_days, 0)),
    hours_delta_vs_prior_period:
      summaryObj.hours_delta_vs_prior_period === null ||
      summaryObj.hours_delta_vs_prior_period === undefined
        ? null
        : finiteNumber(summaryObj.hours_delta_vs_prior_period, 0),
  };

  const trendRaw = v.trend;
  const trend: SessionStatsDto["trend"] = [];
  if (Array.isArray(trendRaw)) {
    for (const row of trendRaw) {
      if (!row || typeof row !== "object") continue;
      const t = row as Record<string, unknown>;
      const label = typeof t.label === "string" ? t.label : "";
      if (!label) continue;
      trend.push({
        label,
        sessions: Math.floor(finiteNonNeg(t.sessions, 0)),
        seconds: Math.floor(finiteNonNeg(t.seconds, 0)),
      });
    }
  }

  const breakdownRaw = v.breakdown;
  const breakdown: SessionStatsDto["breakdown"] = [];
  if (Array.isArray(breakdownRaw)) {
    for (const row of breakdownRaw) {
      if (!row || typeof row !== "object") continue;
      const b = row as Record<string, unknown>;
      const session_type =
        typeof b.session_type === "string" && b.session_type.trim() ? b.session_type : "Unknown";
      const sessions = Math.floor(finiteNonNeg(b.sessions, 0));
      const percent = Math.max(0, Math.min(100, finiteNumber(b.percent, 0)));
      breakdown.push({ session_type, sessions, percent });
    }
  }

  const recent_sessions = parseSessionList(v.recent_sessions);

  const productivity_hint =
    v.productivity_hint === null || v.productivity_hint === undefined
      ? null
      : typeof v.productivity_hint === "string"
        ? v.productivity_hint
        : null;

  const period =
    v.period === "week" || v.period === "month" || v.period === "all"
      ? v.period
      : typeof v.period === "string" && v.period
        ? v.period
        : "week";

  return {
    period,
    summary,
    trend,
    breakdown,
    recent_sessions,
    productivity_hint,
  };
}

export function tryParseHeatmapDays(
  value: unknown,
): { date: string; seconds: number; intensity: number }[] {
  if (!value || typeof value !== "object") return [];
  const v = value as Record<string, unknown>;
  const days = v.days;
  if (!Array.isArray(days)) return [];
  const out: { date: string; seconds: number; intensity: number }[] = [];
  for (const row of days) {
    if (!row || typeof row !== "object") continue;
    const d = row as Record<string, unknown>;
    const date = typeof d.date === "string" ? d.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const seconds = Math.floor(finiteNonNeg(d.seconds, 0));
    const intensity = Math.floor(finiteNonNeg(d.intensity, 0));
    out.push({ date, seconds, intensity: Math.min(4, intensity) });
  }
  return out;
}

export type PersonalRecordRow = {
  key: string;
  label: string;
  value: string;
  context: string | null;
  occurred_at: string | null;
};

export function tryParsePersonalRecords(value: unknown): PersonalRecordRow[] {
  if (!value || typeof value !== "object") return [];
  const v = value as Record<string, unknown>;
  const records = v.records;
  if (!Array.isArray(records)) return [];
  const out: PersonalRecordRow[] = [];
  for (const row of records) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : "";
    const label = typeof r.label === "string" ? r.label : "";
    const val = typeof r.value === "string" ? r.value : "";
    if (!key || !label) continue;
    out.push({
      key,
      label,
      value: val || "—",
      context: r.context === null || r.context === undefined ? null : String(r.context),
      occurred_at:
        r.occurred_at === null || r.occurred_at === undefined
          ? null
          : typeof r.occurred_at === "string"
            ? r.occurred_at
            : String(r.occurred_at),
    });
  }
  return out;
}
