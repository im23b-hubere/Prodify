import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";

import { recordMomentumAction } from "../../../lib/momentum";
import { createChallenge } from "../../../lib/social";
import type { DuelCreateRequest } from "../challengeDraft";
import { notifyChallengeCreated } from "../challengeCreatedSignal";

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; message: string | null };

export function useChallengeSubmit(token: string | null, userId: number | undefined) {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const submit = useCallback(
    async (request: DuelCreateRequest | null) => {
      if (!token || !request) return;
      setSubmitState({ status: "sending" });
      try {
        await createChallenge(token, request);
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setSubmitState({ status: "error", message: e instanceof Error ? e.message : null });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setSubmitState({ status: "sent" });
      notifyChallengeCreated();
      if (userId) recordMomentumAction(userId, "challenge").catch(() => undefined);
    },
    [token, userId],
  );

  return { submitState, submit };
}
