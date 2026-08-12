import type { ForecastComputed } from "../../lib/forecastEngine";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";

export type QuestStatus = "goalComplete" | "ahead" | "onTrack" | "atRisk" | "offTrack";

export function weeklyQuestPresentation(
  feedback: SessionFeedbackComputed,
  forecast: ForecastComputed | null,
): { status: QuestStatus; progressPercent: number } {
  return {
    status: resolveQuestStatus(feedback, forecast),
    progressPercent: clampPercent(
      forecast?.currentProgressPercent ?? feedback.progressPercent ?? 0,
    ),
  };
}

function resolveQuestStatus(
  feedback: SessionFeedbackComputed,
  forecast: ForecastComputed | null,
): QuestStatus {
  if (feedback.remainingSessionsToGoal === 0) return "goalComplete";
  if (forecast?.forecastStatus === "ahead") return "ahead";
  if (forecast?.forecastStatus === "at_risk" || forecast?.forecastStatus === "will_miss") {
    return "atRisk";
  }
  return feedback.newStatus === "off_track" ? "offTrack" : "onTrack";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
