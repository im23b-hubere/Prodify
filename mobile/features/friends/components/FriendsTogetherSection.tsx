import type { TFunction } from "i18next";

import type { BuddyStatusDto, SocialChallengeDto } from "../../../types/friends";
import { FriendsChallengesBody } from "./FriendsTogetherSections";

export type FriendsTogetherProps = {
  t: TFunction;
  busyActionKey: string | null;
  onOpenChallengeCreate: () => void;
  onJoinSocialChallenge: (challengeId: number) => void;
  onOpenSessionSetup: () => void;
  buddy: BuddyStatusDto | null;
  hasOtherFriends: boolean;
  onOpenBuddyPicker: () => void;
  onOpenAddFriend: () => void;
  onAcceptBuddyInvite: (inviteId: number) => void;
  pendingBuddyInviteId: number | null;
  challengeCards: SocialChallengeDto[];
  currentUserId?: number;
};

export function FriendsTogetherSection(props: FriendsTogetherProps) {
  return <FriendsChallengesBody props={props} />;
}
