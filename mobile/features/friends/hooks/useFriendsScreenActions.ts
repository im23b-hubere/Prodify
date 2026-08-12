import { type Href } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";

import { useFriendChallengeActions } from "./useFriendChallengeActions";
import { useFriendEngagementActions } from "./useFriendEngagementActions";
import { useFriendRelationshipActions } from "./useFriendRelationshipActions";
import { useFriendsTriggerCards } from "./useFriendsTriggerCards";
import type { FriendsScreenState } from "./useFriendsScreenState";

type Params = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
  openSession: (sessionId: number, ownerName: string) => void;
  openSessionSetup: () => void;
};

export function useFriendsScreenActions(params: Params) {
  const { token, userId, t, load, state, openSession, openSessionSetup } = params;
  const entries = state.leaderboard?.entries ?? [];
  const friendCandidates = entries.filter((entry) => entry.user_id !== userId);
  const friendCandidateIds = useMemo(
    () => new Set(friendCandidates.map((entry) => entry.user_id)),
    [friendCandidates],
  );
  const relationshipActions = useFriendRelationshipActions({ token, userId, t, load, state });
  const challengeActions = useFriendChallengeActions({ token, userId, t, load, state });
  const engagementActions = useFriendEngagementActions({
    token,
    userId,
    t,
    load,
    state,
    friendCandidateIds,
  });
  const triggerActions = useFriendsTriggerCards({
    token,
    userId,
    t,
    load,
    state,
    challengeCards: challengeActions.challengeCards,
    openSession,
    openSessionSetup,
  });
  const openSessionHref = useCallback(
    (sessionId: number, ownerName: string): Href => ({
      pathname: "/session/[id]",
      params: { id: String(sessionId), ownerName },
    }),
    [],
  );

  return {
    entries,
    hasOtherFriends: friendCandidates.length > 0,
    friendCandidates,
    ...challengeActions,
    ...triggerActions,
    ...relationshipActions,
    ...engagementActions,
    openSessionHref,
  };
}

export type FriendsScreenActions = ReturnType<typeof useFriendsScreenActions>;
