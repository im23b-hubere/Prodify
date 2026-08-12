import type { FriendsScreenController } from "../hooks/useFriendsScreenController";
import { AddFriendModal } from "./AddFriendModal";
import { BuddyPickerModal } from "./BuddyPickerModal";
import { ChallengeCreateModal } from "./ChallengeCreateModal";
import { ReactionUsersModal } from "./ReactionUsersModal";

export function FriendsModals({ controller }: { controller: FriendsScreenController }) {
  const { t, userId, state, actions } = controller;
  const openAddFriend = () => {
    state.setBuddyPickerOpen(false);
    actions.resetChallengeModal();
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
      <ChallengeCreateModal
        t={t}
        open={state.challengeCreateOpen}
        title={state.challengeTitle}
        onTitleChange={state.setChallengeTitle}
        target={state.challengeTarget}
        onTargetChange={state.setChallengeTarget}
        duration={state.challengeDuration}
        onDurationChange={state.setChallengeDuration}
        entries={actions.entries}
        currentUserId={userId}
        selectedMembers={state.selectedMembers}
        setSelectedMembers={state.setSelectedMembers}
        busy={state.challengeCreateBusy}
        onSubmit={actions.submitCreateChallenge}
        onReset={actions.resetChallengeModal}
        onAddFriend={openAddFriend}
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
