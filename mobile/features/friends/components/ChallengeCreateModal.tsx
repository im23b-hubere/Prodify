import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import type { FriendLeaderboardEntryDto } from "../../../types/friends";
import { styles } from "./FriendsModals.styles";

type Props = {
  t: (key: string, options?: Record<string, unknown>) => string;
  open: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  target: string;
  onTargetChange: (value: string) => void;
  duration: string;
  onDurationChange: (value: string) => void;
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
  selectedMembers: number[];
  setSelectedMembers: (updater: (previous: number[]) => number[]) => void;
  busy: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onAddFriend: () => void;
};

export function ChallengeCreateModal(props: Props) {
  const {
    t,
    open: challengeCreateOpen,
    title: challengeTitle,
    onTitleChange: setChallengeTitle,
    target: challengeTarget,
    onTargetChange: setChallengeTarget,
    duration: challengeDuration,
    onDurationChange: setChallengeDuration,
    entries,
    currentUserId,
    selectedMembers,
    setSelectedMembers,
    busy: challengeCreateBusy,
    onSubmit: submitCreateChallenge,
    onReset: resetChallengeModal,
    onAddFriend,
  } = props;
  const setAddOpen = (value: boolean) => {
    if (value) onAddFriend();
  };
  return (
    <Modal
      visible={challengeCreateOpen}
      animationType="slide"
      transparent
      onRequestClose={resetChallengeModal}
    >
      <Pressable style={styles.modalBackdrop} onPress={resetChallengeModal}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("friendsScreen.createChallengeTitle")}</Text>
          <Text style={styles.modalHint}>{t("friendsScreen.createChallengeHint")}</Text>
          <Text style={styles.fieldLabel}>{t("friendsScreen.challengeTitleLabel")}</Text>
          <TextInput
            value={challengeTitle}
            onChangeText={setChallengeTitle}
            placeholder={t("friendsScreen.challengeTitlePlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>{t("friendsScreen.challengeTargetLabel")}</Text>
          <TextInput
            value={challengeTarget}
            onChangeText={setChallengeTarget}
            keyboardType="number-pad"
            placeholder={t("friendsScreen.challengeTargetPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>{t("friendsScreen.challengeDurationLabel")}</Text>
          <TextInput
            value={challengeDuration}
            onChangeText={setChallengeDuration}
            keyboardType="number-pad"
            placeholder={t("friendsScreen.challengeDurationPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <Text style={styles.modalHint}>{t("friendsScreen.challengePickFriendLabel")}</Text>
          <View style={styles.memberChips}>
            {entries.filter((entry) => entry.user_id !== currentUserId).length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyTitle}>
                  {t("friendsScreen.challengeMemberEmptyTitle")}
                </Text>
                <Text style={styles.userMeta}>
                  {t("friendsScreen.challengeMemberEmptyMessage")}
                </Text>
                <PrimaryButton
                  label={t("friendsScreen.challengeMemberEmptyCta")}
                  onPress={() => {
                    resetChallengeModal();
                    setAddOpen(true);
                  }}
                />
              </View>
            ) : (
              entries
                .filter((entry) => entry.user_id !== currentUserId)
                .slice(0, 8)
                .map((entry) => {
                  const selected = selectedMembers.includes(entry.user_id);
                  return (
                    <Pressable
                      key={entry.user_id}
                      style={[styles.memberChip, selected && styles.memberChipSelected]}
                      onPress={() =>
                        setSelectedMembers((prev) =>
                          prev.includes(entry.user_id) ? [] : [entry.user_id],
                        )
                      }
                    >
                      <Text
                        style={[styles.memberChipText, selected && styles.memberChipTextSelected]}
                      >
                        {entry.username}
                      </Text>
                    </Pressable>
                  );
                })
            )}
          </View>
          <PrimaryButton
            label={
              challengeCreateBusy
                ? t("friendsScreen.creatingChallenge")
                : t("friendsScreen.createChallengeCta")
            }
            disabled={challengeCreateBusy}
            onPress={() => void submitCreateChallenge()}
          />
          <Pressable style={styles.modalCancel} onPress={resetChallengeModal}>
            <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
