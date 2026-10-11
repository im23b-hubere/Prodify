import { useCallback } from "react";

import { AppAccessGate } from "../../features/navigation/AppAccessGate";
import { FriendProfileView } from "../../features/profile/components/FriendProfileView";
import { useFriendProfile } from "../../features/profile/hooks/useFriendProfile";
import { useFriendProfileNavigation } from "../../features/profile/hooks/useFriendProfileNavigation";
import { useSendFriendRequest } from "../../features/profile/hooks/useSendFriendRequest";

export default function FriendProfileRoute() {
  return (
    <AppAccessGate>
      <FriendProfileScreen />
    </AppAccessGate>
  );
}

function FriendProfileScreen() {
  const navigation = useFriendProfileNavigation();
  const state = useFriendProfile(navigation.userId);
  const { load } = state;
  const reloadRelationship = useCallback(() => load({ silent: true }), [load]);
  const friendRequest = useSendFriendRequest(reloadRelationship);
  return (
    <FriendProfileView
      state={state}
      isSendingRequest={friendRequest.isSending}
      onBack={navigation.goBack}
      onOpenFriends={navigation.openFriends}
      onOpenSession={navigation.openSession}
      onChallenge={navigation.openChallengeCreate}
      onSendRequest={(username) => void friendRequest.send(username)}
    />
  );
}
