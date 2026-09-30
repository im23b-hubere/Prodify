import type { FriendsScreenController } from "../hooks/useFriendsScreenController";
import { AddFriendModal } from "./AddFriendModal";
import { BuddyPickerModal } from "./BuddyPickerModal";
import { ReactionUsersModal } from "./ReactionUsersModal";

export function FriendsModals({ controller }: { controller: FriendsScreenController }) {
  const { t, state, actions } = controller;
  const openAddFriend = () => {
    state.setBuddyPickerOpen(false);
    state.setAddOpen(true);
  };

  return (
    <>
      <ReactionUsersModal
        t={t}
        open={state.reactionUsersOpen}
        onClose={() => state.setReactionUsersOpen(false)}
        loading={state.reactionUsersLoading}
        users={state.reactionUsers}
      />
      <BuddyPickerModal
        t={t}
        open={state.buddyPickerOpen}
        onClose={() => state.setBuddyPickerOpen(false)}
        onAddFriend={openAddFriend}
        candidates={actions.friendCandidates}
        busy={state.busyActionKey === "buddy_invite"}
        onInvite={actions.inviteBuddy}
      />
      <AddFriendModal
        t={t}
        open={state.addOpen}
        onClose={() => state.setAddOpen(false)}
        username={state.addName}
        onUsernameChange={state.setAddName}
        busy={state.addBusy}
        onSend={actions.sendRequest}
      />
    </>
  );
}
