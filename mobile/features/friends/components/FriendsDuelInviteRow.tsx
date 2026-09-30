import type { TFunction } from "i18next";

import type { SocialChallengeDto } from "../../../types/friends";
import { profilePictureUrl } from "../../profile/friendProfilePresentation";
import { InboxRow } from "./inbox/InboxRow";

export type DuelInviteActions = {
  t: TFunction;
  currentUserId?: number;
  busyActionKey: string | null;
  onAcceptChallengeInvite: (challengeId: number) => void;
  onDeclineChallengeInvite: (challengeId: number) => void;
};

/** An invite someone sent to this user: sender, stakes and a clear accept. */
export function FriendsDuelInviteRow({
  challenge,
  actions,
  divided,
}: {
  challenge: SocialChallengeDto;
  actions: DuelInviteActions;
  divided: boolean;
}) {
  const { t } = actions;
  const sender = challenge.members.find((member) => member.user_id === challenge.owner_id);
  const accepting = actions.busyActionKey === `accept_challenge_${challenge.id}`;
  const stakes = t("duelBoard.inviteStakes", {
    sessions: challenge.target_sessions,
    days: challenge.duration_days ?? 7,
  });
  return (
    <InboxRow
      name={sender?.username ?? t("friendsScreen.challengeSomeone")}
      photoUri={profilePictureUrl(sender?.profile_picture_url)}
      meta={`${t("friendsScreen.challengeInviteIncomingMeta")} · ${stakes}`}
      acceptLabel={t("friendsScreen.accept")}
      declineLabel={t("friendsScreen.challengeDecline")}
      accepting={accepting}
      busy={accepting || actions.busyActionKey === `decline_challenge_${challenge.id}`}
      divided={divided}
      onAccept={() => actions.onAcceptChallengeInvite(challenge.id)}
      onDecline={() => actions.onDeclineChallengeInvite(challenge.id)}
      testID={`duel-invite-${challenge.id}`}
    />
  );
}
