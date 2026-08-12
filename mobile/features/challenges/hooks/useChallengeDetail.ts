import { useTranslation } from "react-i18next";

import {
  challengeLeader,
  challengeOutcome,
  remainingChallengeDays,
  totalChallengeSessions,
} from "../challengeDetailPresentation";
import { useChallengeActions } from "./useChallengeActions";
import { useChallengeDetailData } from "./useChallengeDetailData";
import { useChallengeEdit } from "./useChallengeEdit";

export function useChallengeDetail(
  token: string | null | undefined,
  challengeId: number | null,
  currentUserId: number | undefined,
) {
  const { t } = useTranslation();
  const { setChallenge, ...data } = useChallengeDetailData(token, challengeId);
  const actions = useChallengeActions(token, challengeId, setChallenge);
  const edit = useChallengeEdit(token, challengeId, data.challenge, setChallenge);
  const challenge = data.challenge;
  const isMember =
    typeof currentUserId === "number" &&
    (challenge?.members.some((member) => member.user_id === currentUserId) ?? false);

  return {
    ...data,
    ...actions,
    isMember,
    isOwner: challenge?.owner_id === currentUserId,
    isActive: challenge?.status === "active",
    daysLeft: remainingChallengeDays(challenge),
    leaderMember: challengeLeader(challenge),
    totalSessions: totalChallengeSessions(challenge),
    outcomeLine: challengeOutcome(challenge, currentUserId, t),
    ...edit,
  };
}

export type ChallengeDetailController = ReturnType<typeof useChallengeDetail>;
