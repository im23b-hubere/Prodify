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
  if (score >= 95) return "Perfect focus! Legendary!";
  if (score >= 85) return "Excellent focus!";
  if (score >= 75) return "Great focus!";
  if (score >= 65) return "Good focus!";
  if (score >= 50) return "Decent focus";
  return "Room for improvement";
}

export function getFocusScoreTips(data: FocusScoreData): string[] {
  const tips: string[] = [];
  const denom = data.duration_minutes > 0 ? data.duration_minutes : 1;
  const pauseRatio = data.paused_duration_minutes / denom;

  if (pauseRatio > 0.2) {
    tips.push("Try to minimize pauses for better flow.");
  }
  if (data.duration_minutes < 30) {
    tips.push("Longer sessions often lead to deeper work.");
  }
  if (data.notes_length === 0) {
    tips.push("Add notes to track your progress better.");
  }
  if (data.mood_level <= 2) {
    tips.push("Low energy? Try a quick break before the next session.");
  }
  return tips;
}

export function getFocusColor(score: number): string {
  if (score >= 85) return "#22c55e";
  if (score >= 65) return "#f97316";
  return "#a3a3a3";
}

export function getFocusBenchmark(score: number, userAverage: number | null | undefined): string | null {
  if (userAverage == null || !Number.isFinite(userAverage)) return null;
  const diff = Math.round(score - userAverage);
  if (diff > 10) return `${diff} points above your average`;
  if (diff > 0) return `${diff} points above your average`;
  if (diff === 0) return "Right on your average";
  return `${Math.abs(diff)} points below average — you got this next time`;
}
