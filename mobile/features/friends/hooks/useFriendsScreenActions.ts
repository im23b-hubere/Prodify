import type { TFunction } from "i18next";
import { useMemo } from "react";

import { useFriendChallengeActions } from "./useFriendChallengeActions";
import { useFriendEngagementActions } from "./useFriendEngagementActions";
import { useFriendRelationshipActions } from "./useFriendRelationshipActions";
import type { FriendsScreenState } from "./useFriendsScreenState";

type Params = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (opts?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

export function useFriendsScreenActions(params: Params) {
  const { token, userId, t, load, state } = params;
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
  const pendingBuddyInviteId =
    state.buddy?.status === "pending_incoming" && typeof state.buddy.invite_id === "number"
      ? state.buddy.invite_id
      : null;

  return {
    entries,
    hasOtherFriends: friendCandidates.length > 0,
    friendCandidates,
    pendingBuddyInviteId,
    ...challengeActions,
    ...relationshipActions,
    ...engagementActions,
  };
}

export type FriendsScreenActions = ReturnType<typeof useFriendsScreenActions>;
