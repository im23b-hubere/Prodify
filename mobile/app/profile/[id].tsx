import { FriendProfileView } from "../../features/profile/components/FriendProfileView";
import { useFriendProfile } from "../../features/profile/hooks/useFriendProfile";
import { useFriendProfileNavigation } from "../../features/profile/hooks/useFriendProfileNavigation";

export default function FriendProfileScreen() {
  const navigation = useFriendProfileNavigation();
  const state = useFriendProfile(navigation.userId);
  return (
    <FriendProfileView
      state={state}
      onBack={navigation.goBack}
      onOpenFriends={navigation.openFriends}
      onOpenSession={navigation.openSession}
    />
  );
}
