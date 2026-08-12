import type { FriendLeaderboardEntryDto, SocialReactionUserDto } from "../../../types/friends";
import { AddFriendModal } from "./AddFriendModal";
import { BuddyPickerModal } from "./BuddyPickerModal";
import { ChallengeCreateModal } from "./ChallengeCreateModal";
import { ReactionUsersModal } from "./ReactionUsersModal";

type Props = {
  t: (key: string, options?: Record<string, unknown>) => string;
  reactionUsersOpen: boolean;
  setReactionUsersOpen: (v: boolean) => void;
  reactionUsersLoading: boolean;
  reactionUsers: SocialReactionUserDto[];
  buddyPickerOpen: boolean;
  setBuddyPickerOpen: (v: boolean) => void;
  friendCandidates: FriendLeaderboardEntryDto[];
  busyActionKey: string | null;
  inviteBuddy: (friendUserId: number) => void;
  challengeCreateOpen: boolean;
  setChallengeCreateOpen: (v: boolean) => void;
  challengeTitle: string;
  setChallengeTitle: (v: string) => void;
  challengeTarget: string;
  setChallengeTarget: (v: string) => void;
  challengeDuration: string;
  setChallengeDuration: (v: string) => void;
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
  selectedMembers: number[];
  setSelectedMembers: (updater: (prev: number[]) => number[]) => void;
  challengeCreateBusy: boolean;
  submitCreateChallenge: () => void;
  resetChallengeModal: () => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  addName: string;
  setAddName: (v: string) => void;
  addBusy: boolean;
  sendRequest: () => void;
};

export function FriendsModals({
  t,
  reactionUsersOpen,
  setReactionUsersOpen,
  reactionUsersLoading,
  reactionUsers,
  buddyPickerOpen,
  setBuddyPickerOpen,
  friendCandidates,
  busyActionKey,
  inviteBuddy,
  challengeCreateOpen,
  setChallengeCreateOpen,
  challengeTitle,
  setChallengeTitle,
  challengeTarget,
  setChallengeTarget,
  challengeDuration,
  setChallengeDuration,
  entries,
  currentUserId,
  selectedMembers,
  setSelectedMembers,
  challengeCreateBusy,
  submitCreateChallenge,
  resetChallengeModal,
  addOpen,
  setAddOpen,
  addName,
  setAddName,
  addBusy,
  sendRequest,
}: Props) {
  const openAddFriend = () => {
    setBuddyPickerOpen(false);
    resetChallengeModal();
    setAddOpen(true);
  };

  return (
    <>
      <ReactionUsersModal
        t={t}
        open={reactionUsersOpen}
        onClose={() => setReactionUsersOpen(false)}
        loading={reactionUsersLoading}
        users={reactionUsers}
      />
      <BuddyPickerModal
        t={t}
        open={buddyPickerOpen}
        onClose={() => setBuddyPickerOpen(false)}
        onAddFriend={openAddFriend}
        candidates={friendCandidates}
        busy={busyActionKey === "buddy_invite"}
        onInvite={inviteBuddy}
      />
      <ChallengeCreateModal
        t={t}
        open={challengeCreateOpen}
        title={challengeTitle}
        onTitleChange={setChallengeTitle}
        target={challengeTarget}
        onTargetChange={setChallengeTarget}
        duration={challengeDuration}
        onDurationChange={setChallengeDuration}
        entries={entries}
        currentUserId={currentUserId}
        selectedMembers={selectedMembers}
        setSelectedMembers={setSelectedMembers}
        busy={challengeCreateBusy}
        onSubmit={submitCreateChallenge}
        onReset={resetChallengeModal}
        onAddFriend={openAddFriend}
      />
      <AddFriendModal
        t={t}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        username={addName}
        onUsernameChange={setAddName}
        busy={addBusy}
        onSend={sendRequest}
      />
    </>
  );
}
