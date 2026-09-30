import { useMemo, useReducer } from "react";

import type { SocialChallengeDto } from "../../../types/friends";
import {
  challengeDraftReducer,
  challengeStepIssue,
  createChallengeDraft,
  duelCreateRequest,
  friendDuelStatus,
  matchingPresetId,
  resolvedChallengeTitle,
  stepperBounds,
  weeklyPace,
} from "../challengeDraft";
import type { ChallengeFriendOption } from "../challengeFriends";

type Options = {
  friends: ChallengeFriendOption[];
  challenges: SocialChallengeDto[];
  userId: number | undefined;
  yourName: string;
  initialFriendId?: number | null;
};

export function useChallengeDraft({
  friends,
  challenges,
  userId,
  yourName,
  initialFriendId,
}: Options) {
  const [draft, dispatch] = useReducer(
    challengeDraftReducer,
    { friendId: initialFriendId ?? null },
    createChallengeDraft,
  );

  const friendStatuses = useMemo(
    () =>
      new Map(
        friends.map((friend) => [
          friend.userId,
          friendDuelStatus(friend.userId, challenges, userId),
        ]),
      ),
    [challenges, friends, userId],
  );

  const selectedFriend = friends.find((friend) => friend.userId === draft.friendId) ?? null;
  const selectedFriendStatus = selectedFriend
    ? (friendStatuses.get(selectedFriend.userId) ?? "available")
    : null;
  const title = selectedFriend
    ? resolvedChallengeTitle(draft, yourName, selectedFriend.username)
    : "";
  const stepIssue = challengeStepIssue(draft, draft.step, {
    friendStatus: selectedFriendStatus,
    title,
  });

  return {
    draft,
    dispatch,
    friendStatuses,
    selectedFriend,
    title,
    stepIssue,
    canContinue: stepIssue == null,
    presetId: matchingPresetId(draft),
    bounds: stepperBounds(draft),
    pace: weeklyPace(draft),
    request: stepIssue == null && draft.step === "review" ? duelCreateRequest(draft, title) : null,
  };
}

export type ChallengeDraftController = ReturnType<typeof useChallengeDraft>;
