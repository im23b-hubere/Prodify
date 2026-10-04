import { useEffect } from "react";

import { fetchChallenges } from "../../../lib/social";
import { subscribeChallengeSync } from "../../challenges/sync/challengeSync";
import { duelClashPayload, isAcceptedOwnedDuel } from "../duelClashPayload";
import { loadSeenDuelClashIds, markDuelClashSeen } from "../duelClashSeen";
import { clearDuelClashQueue, showDuelClash } from "../duelClashStore";

/**
 * Queues a clash for every duel this user sent that was accepted while they were away.
 * Runs on sign-in and on every challenge sync (foreground, duel push, challenge writes).
 */
export function useAcceptedDuelWatcher(token: string | null, userId: number | undefined, youLabel: string) {
  useEffect(() => {
    if (!token || !userId) {
      clearDuelClashQueue();
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const [challenges, seen] = await Promise.all([fetchChallenges(token), loadSeenDuelClashIds(userId)]);
        if (cancelled) return;
        for (const challenge of challenges) {
          if (!isAcceptedOwnedDuel(challenge, userId) || seen.has(challenge.id)) continue;
          const payload = duelClashPayload(challenge, userId, youLabel);
          if (!payload) continue;
          await markDuelClashSeen(userId, challenge.id);
          showDuelClash(payload);
        }
      } catch {
        // A missed check retries on the next foreground; the inbox still carries the news.
      }
    };
    void check();
    const unsubscribe = subscribeChallengeSync(() => void check());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [token, userId, youLabel]);
}
