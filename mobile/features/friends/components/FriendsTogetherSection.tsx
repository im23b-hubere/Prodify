import { type Href, useRouter } from "expo-router";
import type { TFunction } from "i18next";

import type { BuddyStatusDto, CommitmentDto, SocialChallengeDto } from "../../../types/friends";
import { FriendsTogetherHud } from "./FriendsTogetherHud";
import {
  TogetherBuddySection,
  TogetherChallengesSection,
  TogetherGetStarted,
} from "./FriendsTogetherSections";

export type FriendsTogetherProps = {
  t: TFunction;
  busyActionKey: string | null;
  onOpenChallengeCreate: () => void;
  onJoinSocialChallenge: (challengeId: number) => void;
  onOpenSessionSetup: () => void;
  buddy: BuddyStatusDto | null;
  commitment: CommitmentDto | null;
  hasOtherFriends: boolean;
  onOpenBuddyPicker: () => void;
  onOpenAddFriend: () => void;
  onAcceptBuddyInvite: (inviteId: number) => void;
  pendingBuddyInviteId: number | null;
  challengeCards: SocialChallengeDto[];
  currentUserId?: number;
};

export function FriendsTogetherSection(props: FriendsTogetherProps) {
  const router = useRouter();
  const activeCount = props.challengeCards.filter(
    (challenge) => challenge.status === "active",
  ).length;
  const showGetStarted =
    props.challengeCards.length === 0 &&
    props.buddy?.status !== "active" &&
    props.buddy?.status !== "pending_incoming" &&
    props.buddy?.status !== "pending_outgoing";
  const openStats = () =>
    router.push({ pathname: "/(tabs)/stats", params: { focus: "yourWeek" } } as Href);
  return (
    <>
      <FriendsTogetherHud
        t={props.t}
        buddy={props.buddy}
        commitment={props.commitment}
        activeChallengeCount={activeCount}
        onViewCommitment={props.commitment ? openStats : undefined}
      />
      {showGetStarted ? (
        <TogetherGetStarted props={props} />
      ) : (
        <>
          <TogetherBuddySection props={props} />
          <TogetherChallengesSection props={props} activeCount={activeCount} />
        </>
      )}
    </>
  );
}
