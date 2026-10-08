import type { TFunction } from "i18next";

import { skillFocusText } from "../../../lib/skillI18n";
import type { SessionDto } from "../../../types/session";
import type { SessionData } from "./types";

export const SHARE_EXPORT_WIDTH = 1080;
export const SHARE_EXPORT_HEIGHT = 1920;

/** Map a saved session onto the share card. Streak is omitted: this screen does not load it. */
export function sessionShareData(
  session: SessionDto,
  producerName: string | undefined,
  t: TFunction,
): SessionData {
  const durationSeconds = Math.max(0, Math.floor(session.duration_seconds ?? 0));
  const started = new Date(session.started_at);
  const dateLabel = Number.isNaN(started.getTime())
    ? ""
    : started
        // The producer's own calendar day: an evening session must not show tomorrow's date.
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();
  const activities: SessionData["activities"][number][] = [];
  let used = 0;
  for (const row of session.focus_times ?? []) {
    const seconds = Math.floor(row.assigned_seconds);
    if (!Number.isFinite(seconds) || seconds <= 0 || used + seconds > durationSeconds) continue;
    used += seconds;
    activities.push({
      label: skillFocusText(row.skill_id, "label", t),
      durationSeconds: seconds,
    });
  }
  return {
    id: String(session.id),
    producerName: (producerName ?? "").replace(/^@/, ""),
    dateLabel,
    durationSeconds,
    activities,
  };
}
