import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";
import { FriendProfileView } from "../../features/profile/components/FriendProfileView";
import { useFriendProfile } from "../../features/profile/hooks/useFriendProfile";
import { useFriendProfileNavigation } from "../../features/profile/hooks/useFriendProfileNavigation";
import { useRemoveFriendship } from "../../features/profile/hooks/useRemoveFriendship";
import { useSendFriendRequest } from "../../features/profile/hooks/useSendFriendRequest";
import { ReportSheet } from "../../features/safety/components/ReportSheet";
import { useProfileSafety } from "../../features/safety/hooks/useProfileSafety";

export default function FriendProfileRoute() {
  return (
    <AppAccessGate>
      <FriendProfileScreen />
    </AppAccessGate>
  );
}

function FriendProfileScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigation = useFriendProfileNavigation();
  const state = useFriendProfile(navigation.userId);
  const { load } = state;
  const reloadRelationship = useCallback(() => load({ silent: true }), [load]);
  const friendRequest = useSendFriendRequest(reloadRelationship);
  const removeFriendship = useRemoveFriendship(reloadRelationship);
  const name = state.visible?.profile.username ?? state.targetUsername;
  const safety = useProfileSafety({
    token,
    t,
    userId: navigation.userId,
    name,
    status: state.status,
    friendshipId: state.friendshipId,
    onBlocked: navigation.goBack,
    onUnfriend: (friendshipId) =>
      void removeFriendship.remove(friendshipId, { confirm: true, name }),
  });
  const { report } = safety;
  return (
    <>
      <FriendProfileView
        state={state}
        isSendingRequest={friendRequest.isSending}
        isWithdrawingRequest={removeFriendship.isRemoving}
        onBack={navigation.goBack}
        onOpenMenu={safety.openMenu}
        onOpenFriends={navigation.openFriends}
        onOpenSession={navigation.openSession}
        onChallenge={navigation.openChallengeCreate}
        onSendRequest={(username) => void friendRequest.send(username)}
        onWithdrawRequest={() => {
          if (state.friendshipId == null) {
            void reloadRelationship();
            return;
          }
          void removeFriendship.remove(state.friendshipId);
        }}
        onOpenRankPath={navigation.openRankPath}
      />
      <ReportSheet
        visible={report.target !== null}
        kind="user"
        targetName={name ?? ""}
        phase={report.phase}
        error={report.error}
        onSubmit={(draft) => void report.submit(draft)}
        onBlock={safety.blockAfterReport}
        onClose={report.close}
      />
    </>
  );
}
