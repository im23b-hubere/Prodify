import { View } from "react-native";

import type { SocialChallengeDto } from "../../../types/friends";
import { friendsIncomingStyles } from "../styles/friendsIncoming.styles";
import { friendsTogetherStyles } from "../styles/friendsTogether.styles";
import { isIncomingDuelInvite } from "../utils/duelInvites";
import { type DuelInviteActions, FriendsDuelInviteRow } from "./FriendsDuelInviteRow";
import { FriendsSectionHeader } from "./FriendsSectionHeader";

/** Incoming duel invites sit above both tabs, next to friend requests, so they cannot be missed. */
export function FriendsDuelInvitesSection({
  challenges,
  actions,
}: {
  challenges: SocialChallengeDto[];
  actions: DuelInviteActions;
}) {
  const invites = challenges.filter((challenge) => isIncomingDuelInvite(challenge, actions.currentUserId));
  if (invites.length === 0) return null;
  return (
    <View style={friendsIncomingStyles.sectionWrap} testID="friends-duel-invites">
      <FriendsSectionHeader title={actions.t("friendsScreen.duelInvitesTitle", { count: invites.length })} />
      <View style={friendsTogetherStyles.listCard}>
        {invites.map((challenge, index) => (
          <FriendsDuelInviteRow key={challenge.id} challenge={challenge} actions={actions} divided={index > 0} />
        ))}
      </View>
    </View>
  );
}
