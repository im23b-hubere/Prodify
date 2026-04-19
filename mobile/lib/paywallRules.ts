import type { SessionDto } from "../types/session";

export type PaywallVariant = "value" | "outcome" | "social_proof";
export type PaywallTriggerContext = {
  completedSessionsCount: number;
  sawFirstWeeklyReview: boolean;
  openedFirstInsight: boolean;
};

export function pickPaywallVariant(ctx: PaywallTriggerContext): PaywallVariant {
  if (ctx.openedFirstInsight) return "outcome";
  if (ctx.sawFirstWeeklyReview) return "social_proof";
  return "value";
}

export function shouldTriggerPaywall(ctx: PaywallTriggerContext): boolean {
  if (ctx.completedSessionsCount >= 5) return true;
  if (ctx.sawFirstWeeklyReview) return true;
  if (ctx.openedFirstInsight) return true;
  return false;
}

export function completedSessionsCount(sessions: SessionDto[]): number {
  return sessions.filter((s) => s.stopped_at !== null && typeof s.duration_seconds === "number")
    .length;
}
