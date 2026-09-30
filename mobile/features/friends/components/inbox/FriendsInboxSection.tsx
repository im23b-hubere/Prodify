import type { TFunction } from "i18next";
import { View } from "react-native";

import { ListSection } from "../../../../components/ui/list/ListSection";
import type { FriendIncomingDto, SocialChallengeDto } from "../../../../types/friends";
import { profilePictureUrl } from "../../../profile/friendProfilePresentation";
import type { FriendRequestsInFlight } from "../../hooks/useFriendsScreenState";
import { friendsInboxStyles as styles } from "../../styles/friendsInbox.styles";
import { isIncomingDuelInvite } from "../../utils/duelInvites";
import { type DuelInviteActions, FriendsDuelInviteRow } from "../FriendsDuelInviteRow";
import { InboxRow } from "./InboxRow";

type Props = {
  t: TFunction;
  incoming: FriendIncomingDto[];
  challenges: SocialChallengeDto[];
  requestsInFlight: FriendRequestsInFlight;
  onAcceptRequest: (id: number) => void;
  onDeclineRequest: (id: number) => void;
  duelActions: DuelInviteActions;
};

/** Friend requests and duel invites in one card above both tabs, so nothing waiting gets missed. */
export function FriendsInboxSection({
  t,
  incoming,
  challenges,
  requestsInFlight,
  onAcceptRequest,
  onDeclineRequest,
  duelActions,
}: Props) {
  const duelInvites = challenges.filter((challenge) =>
    isIncomingDuelInvite(challenge, duelActions.currentUserId),
  );
  const total = duelInvites.length + incoming.length;
  if (total === 0) return null;
  return (
    <View style={styles.inbox}>
      <ListSection title={t("friendsOverview.inboxTitle")} count={total} testID="friends-inbox">
        {duelInvites.map((challenge, index) => (
          <FriendsDuelInviteRow
            key={`duel-${challenge.id}`}
            challenge={challenge}
            actions={duelActions}
            divided={index > 0}
          />
        ))}
        {incoming.map((request, index) => (
          <InboxRow
            key={`request-${request.id}`}
            name={request.username}
            photoUri={profilePictureUrl(request.profile_picture_url)}
            meta={t("friendsOverview.requestMeta")}
            acceptLabel={t("friendsScreen.accept")}
            declineLabel={t("friendsScreen.decline")}
            pendingAction={requestsInFlight[request.id] ?? null}
            divided={duelInvites.length + index > 0}
            onAccept={() => onAcceptRequest(request.id)}
            onDecline={() => onDeclineRequest(request.id)}
            testID={`friend-request-${request.id}`}
          />
        ))}
      </ListSection>
    </View>
  );
}
