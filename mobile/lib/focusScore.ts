import type { TFunction } from "i18next";

import i18n from "./i18n";

export type FocusScoreData = {
  duration_minutes: number;
  paused_duration_minutes: number;
  pause_count?: number;
  background_switches?: number;
  session_type: string;
  notes_length: number;
  mood_level: number;
  time_of_day?: number;
};

/** Mirrors server `calculate_focus_score` for client previews and tips. */
export function calculateFocusScore(data: FocusScoreData): number {
  const duration_minutes = data.duration_minutes;
  const paused_duration_minutes = data.paused_duration_minutes;
  if (duration_minutes <= 0 && paused_duration_minutes <= 0) return 0;

  let score = 100;
  const mood = Number.isFinite(data.mood_level) ? data.mood_level : 3;
  const pause_count =
    typeof data.pause_count === "number" && Number.isFinite(data.pause_count)
      ? Math.max(0, data.pause_count)
      : paused_duration_minutes > 0
        ? 1
        : 0;
  const background_switches =
    typeof data.background_switches === "number" && Number.isFinite(data.background_switches)
      ? Math.max(0, data.background_switches)
      : 0;

  if (paused_duration_minutes > 0 && duration_minutes > 0) {
    const pauseRatio = paused_duration_minutes / duration_minutes;
    if (pauseRatio > 0.4) score -= 35;
    else if (pauseRatio > 0.25) score -= 20;
    else if (pauseRatio > 0.15) score -= 10;
    else if (pauseRatio > 0.05) score -= 5;
  } else if (paused_duration_minutes > 0) {
    score -= 5;
  }

  if (pause_count > 5) score -= 15;
  else if (pause_count > 3) score -= 8;
  else if (pause_count > 1) score -= 3;

  if (background_switches > 10) score -= 20;
  else if (background_switches > 5) score -= 10;
  else if (background_switches > 2) score -= 5;

  if (duration_minutes < 15) score -= 10;
  else if (duration_minutes < 30) score -= 5;
  else if (duration_minutes >= 90) score += 5;

  if (data.notes_length > 100) score += 3;
  else if (data.notes_length === 0) score -= 2;

  if (mood >= 4) score += 2;

  const tod = typeof data.time_of_day === "number" && Number.isFinite(data.time_of_day) ? data.time_of_day : null;
  if (tod != null && (tod >= 1 && tod <= 5)) {
    // Slight fatigue penalty for deep-night sessions.
    score -= 2;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getFocusScoreMessage(score: number): string {
  if (score >= 95) return i18n.t("focusScore.messages.perfect");
  if (score >= 85) return i18n.t("focusScore.messages.excellent");
  if (score >= 75) return i18n.t("focusScore.messages.great");
  if (score >= 65) return i18n.t("focusScore.messages.good");
  if (score >= 50) return i18n.t("focusScore.messages.decent");
  return i18n.t("focusScore.messages.roomForImprovement");
}

export function getFocusScoreTips(data: FocusScoreData, tr: TFunction): string[] {
  const tips: string[] = [];
  const denom = data.duration_minutes > 0 ? data.duration_minutes : 1;
  const pauseRatio = data.paused_duration_minutes / denom;

  if (pauseRatio > 0.2) {
    tips.push(tr("focusScore.tips.minimizePauses"));
  }
  if (data.duration_minutes < 30) {
    tips.push(tr("focusScore.tips.longerSessions"));
  }
  if (data.notes_length === 0) {
    tips.push(tr("focusScore.tips.addNotes"));
  }
  if (data.mood_level <= 2) {
    tips.push(tr("focusScore.tips.lowEnergy"));
  }
  return tips;
}

export function getFocusColor(score: number): string {
  if (score >= 85) return "#22c55e";
  if (score >= 65) return "#f97316";
  return "#a3a3a3";
}

export function getFocusBenchmark(
  score: number,
  userAverage: number | null | undefined,
  tr: TFunction,
): string | null {
  if (userAverage == null || !Number.isFinite(userAverage)) return null;
  const diff = Math.round(score - userAverage);
  if (diff > 0) return tr("focusScore.benchmark.above", { diff });
  if (diff === 0) return tr("focusScore.benchmark.onAverage");
  return tr("focusScore.benchmark.below", { diff: Math.abs(diff) });
}
