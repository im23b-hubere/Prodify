import { Modal, Pressable, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import type { FriendLeaderboardEntryDto } from "../../../types/friends";
import { styles } from "./FriendsModals.styles";

type Props = {
  t: (key: string, options?: Record<string, unknown>) => string;
  open: boolean;
  onClose: () => void;
  onAddFriend: () => void;
  candidates: FriendLeaderboardEntryDto[];
  busy: boolean;
  onInvite: (userId: number) => void;
};

export function BuddyPickerModal({
  t,
  open: buddyPickerOpen,
  onClose,
  onAddFriend,
  candidates: friendCandidates,
  busy,
  onInvite: inviteBuddy,
}: Props) {
  const busyActionKey = busy ? "buddy_invite" : null;
  const setBuddyPickerOpen = (value: boolean) => {
    if (!value) onClose();
  };
  const setAddOpen = (value: boolean) => {
    if (value) onAddFriend();
  };
  return (
    <Modal
      visible={buddyPickerOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setBuddyPickerOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setBuddyPickerOpen(false)}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("friendsScreen.pickBuddyTitle")}</Text>
          <Text style={styles.modalHint}>{t("friendsScreen.pickBuddyHint")}</Text>
          <View style={styles.memberChips}>
            {friendCandidates.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyTitle}>
                  {t("friendsScreen.buddyPickerEmptyTitle")}
                </Text>
                <Text style={styles.userMeta}>{t("friendsScreen.buddyPickerEmptyMessage")}</Text>
                <PrimaryButton
                  label={t("friendsScreen.buddyPickerEmptyCta")}
                  onPress={() => {
                    setBuddyPickerOpen(false);
                    setAddOpen(true);
                  }}
                />
              </View>
            ) : (
              friendCandidates.slice(0, 12).map((entry) => (
                <Pressable
                  key={`buddy-${entry.user_id}`}
                  style={styles.memberChip}
                  disabled={busyActionKey === "buddy_invite"}
                  onPress={() => void inviteBuddy(entry.user_id)}
                >
                  <Text style={styles.memberChipText}>{entry.username}</Text>
                </Pressable>
              ))
            )}
          </View>
          <Pressable style={styles.modalCancel} onPress={() => setBuddyPickerOpen(false)}>
            <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
