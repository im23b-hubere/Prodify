import type { TFunction } from "i18next";
import { useCallback, useState } from "react";

import { ApiError } from "../../../lib/client";
import { reportComment, reportUser, type ReportDraft } from "../../../lib/moderation";

export type ReportTarget =
  | { kind: "user"; userId: number; name: string }
  | { kind: "comment"; commentId: number; authorId: number; name: string };

export type ReportPhase = "editing" | "submitting" | "done";

/** Drives the report sheet: which target is open, sending, and the confirmation once it went through. */
export function useReportFlow(token: string | null | undefined, t: TFunction) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [phase, setPhase] = useState<ReportPhase>("editing");
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((next: ReportTarget) => {
    setTarget(next);
    setPhase("editing");
    setError(null);
  }, []);

  const close = useCallback(() => setTarget(null), []);

  const submit = useCallback(
    async (draft: ReportDraft) => {
      if (!token || !target) return;
      setPhase("submitting");
      setError(null);
      try {
        await sendReport(token, target, draft);
        setPhase("done");
      } catch (caught) {
        setPhase("editing");
        setError(reportErrorMessage(caught, t));
      }
    },
    [t, target, token],
  );

  return { target, phase, error, open, close, submit };
}

export type ReportFlow = ReturnType<typeof useReportFlow>;

function sendReport(token: string, target: ReportTarget, draft: ReportDraft): Promise<void> {
  return target.kind === "user"
    ? reportUser(token, target.userId, draft)
    : reportComment(token, target.commentId, draft);
}

function reportErrorMessage(caught: unknown, t: TFunction): string {
  if (caught instanceof ApiError && caught.status === 429) return t("safety.report.limitReached");
  return t("safety.report.failed");
}
