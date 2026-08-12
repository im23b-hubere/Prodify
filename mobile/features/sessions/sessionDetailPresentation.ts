import type { TFunction } from "i18next";

import { sessionTrackOutcomeLabel } from "../../lib/sessionI18n";
import { sessionTagsList } from "../../lib/sessionDto";
import { formatDurationWords, parseSessionDate } from "../../lib/sessionTime";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";

type RouteParam = string | string[] | undefined;

export function resolveSessionDetailParams(
  rawId: RouteParam,
  rawOwnerName: RouteParam,
  routeSegments: string[],
) {
  return {
    sessionId: firstValue(rawId) || sessionIdFromSegments(routeSegments),
    ownerName: firstValue(rawOwnerName),
  };
}

export function buildSessionDetailPresentation(
  session: SessionDto,
  insights: SessionDetailInsightsDto | null,
  t: TFunction,
) {
  const start = parseSessionDate(session.started_at);
  const end = session.stopped_at ? parseSessionDate(session.stopped_at) : null;
  const pauseSeconds = session.paused_duration_seconds ?? 0;
  const timelinePauseCount =
    insights?.timeline?.filter((segment) => segment.kind === "paused").length ?? 0;
  const hasMeaningfulPause = pauseSeconds >= 60;
  return {
    durationLabel:
      session.duration_seconds != null
        ? formatDurationWords(session.duration_seconds)
        : t("sessionDetail.inProgress"),
    tags: sessionTagsList(session.tags),
    pauseSeconds,
    hasMeaningfulPause,
    pauseCount: hasMeaningfulPause ? Math.max(1, timelinePauseCount) : 0,
    isActiveSession: session.stopped_at == null,
    dateLine: formatSessionDateLine(start, end),
    focusScore: insights?.focus_score ?? session.focus_score ?? null,
    trackOutcomeLabel: sessionTrackOutcomeLabel(session.track_outcome, t),
  };
}

export type SessionDetailPresentation = ReturnType<typeof buildSessionDetailPresentation>;

function firstValue(value: RouteParam): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}

function sessionIdFromSegments(routeSegments: string[]): string | undefined {
  const sessionSegmentIndex = routeSegments.indexOf("session");
  const candidate = routeSegments[sessionSegmentIndex + 1];
  return sessionSegmentIndex >= 0 && candidate && /^\d+$/.test(candidate) ? candidate : undefined;
}

function formatSessionDateLine(start: Date, end: Date | null): string {
  if (!Number.isFinite(start.getTime())) return "—";
  const date = start.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const hasValidEnd = end && Number.isFinite(end.getTime());
  const endTime = hasValidEnd
    ? ` – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : "";
  return `${date} · ${startTime}${endTime}`;
}
