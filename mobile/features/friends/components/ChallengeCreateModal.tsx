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

function ChallengeFields({ props }: { props: Props }) {
  const { t } = props;
  const fields = [
    {
      label: t("friendsScreen.challengeTitleLabel"),
      value: props.title,
      onChangeText: props.onTitleChange,
      placeholder: t("friendsScreen.challengeTitlePlaceholder"),
      keyboardType: "default" as const,
    },
    {
      label: t("friendsScreen.challengeTargetLabel"),
      value: props.target,
      onChangeText: props.onTargetChange,
      placeholder: t("friendsScreen.challengeTargetPlaceholder"),
      keyboardType: "number-pad" as const,
    },
    {
      label: t("friendsScreen.challengeDurationLabel"),
      value: props.duration,
      onChangeText: props.onDurationChange,
      placeholder: t("friendsScreen.challengeDurationPlaceholder"),
      keyboardType: "number-pad" as const,
    },
  ];
  return (
    <>
      {fields.map((field) => (
        <View key={field.label}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <TextInput
            accessibilityLabel={field.label}
            value={field.value}
            onChangeText={field.onChangeText}
            keyboardType={field.keyboardType}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
        </View>
      ))}
    </>
  );
}

function MemberPicker({ props }: { props: Props }) {
  const candidates = props.entries
    .filter((entry) => entry.user_id !== props.currentUserId)
    .slice(0, 8);
  if (candidates.length === 0) {
    return (
      <View style={styles.modalEmpty}>
        <Text style={styles.modalEmptyTitle}>
          {props.t("friendsScreen.challengeMemberEmptyTitle")}
        </Text>
        <Text style={styles.userMeta}>{props.t("friendsScreen.challengeMemberEmptyMessage")}</Text>
        <PrimaryButton
          label={props.t("friendsScreen.challengeMemberEmptyCta")}
          onPress={() => {
            props.onReset();
            props.onAddFriend();
          }}
        />
      </View>
    );
  }
  return (
    <View style={styles.memberChips}>
      {candidates.map((entry) => {
        const selected = props.selectedMembers.includes(entry.user_id);
        return (
          <Pressable
            key={entry.user_id}
            accessibilityRole="button"
            accessibilityLabel={entry.username}
            accessibilityState={{ selected }}
            style={[styles.memberChip, selected && styles.memberChipSelected]}
            onPress={() =>
              props.setSelectedMembers((previous) =>
                previous.includes(entry.user_id) ? [] : [entry.user_id],
              )
            }
          >
            <Text style={[styles.memberChipText, selected && styles.memberChipTextSelected]}>
              {entry.username}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChallengeCreateModal(props: Props) {
  const { t, open, busy, onSubmit, onReset } = props;
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onReset}>
      <Pressable style={styles.modalBackdrop} onPress={onReset}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("friendsScreen.createChallengeTitle")}</Text>
          <Text style={styles.modalHint}>{t("friendsScreen.createChallengeHint")}</Text>
          <ChallengeFields props={props} />
          <Text style={styles.modalHint}>{t("friendsScreen.challengePickFriendLabel")}</Text>
          <MemberPicker props={props} />
          <PrimaryButton
            label={
              busy ? t("friendsScreen.creatingChallenge") : t("friendsScreen.createChallengeCta")
            }
            disabled={busy}
            onPress={() => void onSubmit()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendsScreen.modalCancel")}
            style={styles.modalCancel}
            onPress={onReset}
          >
            <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
