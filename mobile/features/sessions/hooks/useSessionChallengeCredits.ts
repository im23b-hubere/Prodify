import { useEffect, useState } from "react";

import { fetchSessionChallengeCredits } from "../../../lib/social";
import type { SessionChallengeCreditDto } from "../../../types/friends";

const NO_CREDITS: SessionChallengeCreditDto[] = [];

/** Empty until loaded and on failure: the card is a bonus, never a blocker for the summary. */
export function useSessionChallengeCredits(
  token: string | null,
  sessionId: string | undefined,
): SessionChallengeCreditDto[] {
  const [credits, setCredits] = useState<SessionChallengeCreditDto[]>(NO_CREDITS);

  useEffect(() => {
    if (!token || !sessionId) return;
    let cancelled = false;
    fetchSessionChallengeCredits(token, sessionId)
      .then((result) => {
        if (!cancelled) setCredits(Array.isArray(result) ? result : NO_CREDITS);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  return credits;
}
