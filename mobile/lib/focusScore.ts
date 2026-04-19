import type { TFunction } from "i18next";

import i18n from "./i18n";

export type FocusScoreData = {
  duration_minutes: number;
  paused_duration_minutes: number;
  session_type: string;
  notes_length: number;
  mood_level: number;
};

/** Mirrors server `calculate_focus_score` for client previews and tips. */
export function calculateFocusScore(data: FocusScoreData): number {
  const duration_minutes = data.duration_minutes;
  const paused_duration_minutes = data.paused_duration_minutes;
  if (duration_minutes <= 0 && paused_duration_minutes <= 0) return 0;

  let score = 100;
  const mood = Number.isFinite(data.mood_level) ? data.mood_level : 3;

  if (paused_duration_minutes > 0 && duration_minutes > 0) {
    const pauseRatio = paused_duration_minutes / duration_minutes;
    if (pauseRatio > 0.3) score -= 40;
    else if (pauseRatio > 0.15) score -= 20;
    else score -= 10;
  } else if (paused_duration_minutes > 0) {
    score -= 10;
  }

  if (duration_minutes < 15) score -= 15;
  else if (duration_minutes > 120) score += 10;

  if (data.notes_length > 50) score += 5;
  else if (data.notes_length === 0) score -= 5;

  if (mood >= 4) score += 5;

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
