import type { TFunction } from "i18next";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { fontFamily } from "../../../constants/fonts";
import type { FriendLeaderboardEntryDto, SocialReactionUserDto } from "../../../types/friends";
import { challengeKindLabel } from "../utils/friendsScreenFormat";

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
  goalEditorOpen: boolean;
  setGoalEditorOpen: (v: boolean) => void;
  goalTargetInput: string;
  setGoalTargetInput: (v: string) => void;
  goalDaysInput: string;
  setGoalDaysInput: (v: string) => void;
  goalWitnesses: number[];
  setGoalWitnesses: (updater: (prev: number[]) => number[]) => void;
  goalSaving: boolean;
  saveCommitmentTarget: () => void;
  challengeCreateOpen: boolean;
  setChallengeCreateOpen: (v: boolean) => void;
  challengeTitle: string;
  setChallengeTitle: (v: string) => void;
  challengeKind: "duel" | "team" | "group";
  setChallengeKind: (v: "duel" | "team" | "group") => void;
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
  goalEditorOpen,
  setGoalEditorOpen,
  goalTargetInput,
  setGoalTargetInput,
  goalDaysInput,
  setGoalDaysInput,
  goalWitnesses,
  setGoalWitnesses,
  goalSaving,
  saveCommitmentTarget,
  challengeCreateOpen,
  setChallengeCreateOpen,
  challengeTitle,
  setChallengeTitle,
  challengeKind,
  setChallengeKind,
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
  addOpen,
  setAddOpen,
  addName,
  setAddName,
  addBusy,
  sendRequest,
}: Props) {
  return (
    <>
      <Modal
        visible={reactionUsersOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setReactionUsersOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReactionUsersOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.reactionsTitle")}</Text>
            {(reactionUsersLoading
              ? [
                  {
                    username: t("friendsScreen.loading"),
                    emoji: "",
                    user_id: -1,
                    created_at: "loading",
                  },
                ]
              : reactionUsers.length === 0
                ? [
                    {
                      username: t("friendsScreen.noReactionsYet"),
                      emoji: "",
                      user_id: -1,
                      created_at: "",
                    },
                  ]
                : reactionUsers
            ).map((row) => (
              <Text key={`${row.user_id}-${row.created_at}-${row.emoji}`} style={styles.userMeta}>
                {row.emoji} {row.username}
              </Text>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

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
                <Text style={styles.userMeta}>{t("friendsScreen.feedEmptyMessage")}</Text>
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

      <Modal
        visible={goalEditorOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGoalEditorOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGoalEditorOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.editGoalTitle")}</Text>
            <Text style={styles.modalHint}>{t("friendsScreen.editGoalHint")}</Text>
            <Text style={styles.fieldLabel}>{t("friendsScreen.goalTargetLabel")}</Text>
            <TextInput
              value={goalTargetInput}
              onChangeText={setGoalTargetInput}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeTargetPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>{t("friendsScreen.goalDurationLabel")}</Text>
            <TextInput
              value={goalDaysInput}
              onChangeText={setGoalDaysInput}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeDurationPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <Text style={styles.modalHint}>{t("friendsScreen.witnessesLabel")}</Text>
            <View style={styles.memberChips}>
              {friendCandidates.length === 0 ? (
                <Text style={styles.userMeta}>{t("friendsScreen.feedEmptyMessage")}</Text>
              ) : (
                friendCandidates.slice(0, 12).map((entry) => {
                  const selected = goalWitnesses.includes(entry.user_id);
                  return (
                    <Pressable
                      key={`witness-${entry.user_id}`}
                      style={[styles.memberChip, selected && styles.memberChipSelected]}
                      onPress={() =>
                        setGoalWitnesses((prev) => {
                          if (prev.includes(entry.user_id)) {
                            return prev.filter((id) => id !== entry.user_id);
                          }
                          if (prev.length >= 3) return prev;
                          return [...prev, entry.user_id];
                        })
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
              label={goalSaving ? t("friendsScreen.loading") : t("friendsScreen.saveGoal")}
              disabled={goalSaving}
              onPress={() => void saveCommitmentTarget()}
            />
            <Pressable style={styles.modalCancel} onPress={() => setGoalEditorOpen(false)}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={challengeCreateOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setChallengeCreateOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setChallengeCreateOpen(false)}>
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
            <View style={styles.toggleRow}>
              {(["duel", "team", "group"] as const).map((kind) => (
                <Pressable
                  key={kind}
                  style={[styles.toggleChip, challengeKind === kind && styles.toggleChipActive]}
                  onPress={() => setChallengeKind(kind)}
                >
                  <Text
                    style={[styles.toggleText, challengeKind === kind && styles.toggleTextActive]}
                  >
                    {challengeKindLabel(kind, t as TFunction)}
                  </Text>
                </Pressable>
              ))}
            </View>
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
            <Text style={styles.modalHint}>{t("friendsScreen.participantsLabel")}</Text>
            <View style={styles.memberChips}>
              {entries
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
                          prev.includes(entry.user_id)
                            ? prev.filter((id) => id !== entry.user_id)
                            : [...prev, entry.user_id],
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
                })}
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
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.modalTitle")}</Text>
            <Text style={styles.modalHint}>{t("friendsScreen.modalHint")}</Text>
            <TextInput
              value={addName}
              onChangeText={setAddName}
              placeholder={t("friendsScreen.placeholderUsername")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <PrimaryButton
              label={addBusy ? t("friendsScreen.sendingRequest") : t("friendsScreen.sendRequest")}
              onPress={() => sendRequest()}
              disabled={addBusy}
            />
            <Pressable style={styles.modalCancel} onPress={() => setAddOpen(false)}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  modalHint: { color: colors.textSecondary, ...typography.caption },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    marginBottom: -spacing.xs,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
  },
  modalCancel: { alignItems: "center", paddingVertical: spacing.sm },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  userMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  memberChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  memberChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberChipSelected: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.18)" },
  memberChipText: { color: colors.textSecondary, ...typography.caption },
  memberChipTextSelected: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  toggleChip: {
    flex: 1,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  toggleChipActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.2)" },
  toggleText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
  toggleTextActive: { color: colors.textPrimary },
});
