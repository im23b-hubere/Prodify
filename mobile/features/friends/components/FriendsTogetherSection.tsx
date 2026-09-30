import type { TFunction } from "i18next";

import type {
  BuddyStatusDto,
  DuelRecordDto,
  FriendLeaderboardEntryDto,
  SocialChallengeDto,
} from "../../../types/friends";
import type { RematchRequest } from "../../challenges/board/duelBoard";
import { FriendsChallengesBody } from "./FriendsTogetherSections";

export type FriendsTogetherProps = {
  t: TFunction;
  busyActionKey: string | null;
  onOpenChallengeCreate: () => void;
  onChallengeFriend: (friendId: number) => void;
  onRematchDuel: (request: RematchRequest) => void;
  onOpenChallenge: (challengeId: number) => void;
  onWithdrawChallengeInvite: (challenge: SocialChallengeDto) => void;
  onOpenSessionSetup: () => void;
  buddy: BuddyStatusDto | null;
  hasOtherFriends: boolean;
  onOpenBuddyPicker: () => void;
  onOpenAddFriend: () => void;
  onAcceptBuddyInvite: (inviteId: number) => void;
  pendingBuddyInviteId: number | null;
  friends: FriendLeaderboardEntryDto[];
  challengeCards: SocialChallengeDto[];
  duelRecords: DuelRecordDto[];
  currentUserId?: number;
};

export function FriendsTogetherSection(props: FriendsTogetherProps) {
  return <FriendsChallengesBody props={props} />;
}
