import type { TFunction } from "i18next";
import { Modal, Pressable, Switch, Text, TextInput, View } from "react-native";

import { colors } from "../../constants/theme";
import { WEEKLY_GOAL_CHIPS } from "../../features/stats/useYourWeekGoalEditor";
import { PrimaryButton } from "../ui/PrimaryButton";
import { yourWeekStyles as styles } from "./yourWeek.styles";

type Props = {
  t: TFunction;
  visible: boolean;
  busy: boolean;
  selectedTarget: number;
  customTarget: string;
  shareWithFriends: boolean;
  onClose: () => void;
  onSelectPreset: (target: number) => void;
  onChangeCustomTarget: (target: string) => void;
  onChangeSharing: (enabled: boolean) => void;
  onSave: () => Promise<void>;
};

export function YourWeekGoalEditorModal({
  t,
  visible,
  busy,
  selectedTarget,
  customTarget,
  shareWithFriends,
  onClose,
  onSelectPreset,
  onChangeCustomTarget,
  onChangeSharing,
  onSave,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("stats.yourWeek.editTitle")}</Text>
          <Text style={styles.modalHint}>{t("stats.yourWeek.editHint")}</Text>
          <View style={styles.chipRow}>
            {WEEKLY_GOAL_CHIPS.map((target) => {
              const selected = !customTarget && selectedTarget === target;
              return (
                <Pressable
                  key={`edit-${target}`}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => onSelectPreset(target)}
                >
                  <Text style={[styles.chipValue, selected && styles.chipValueSelected]}>
                    {target}
                  </Text>
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {t("stats.yourWeek.sessionsUnit")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={customTarget}
            onChangeText={onChangeCustomTarget}
            keyboardType="number-pad"
            placeholder={t("stats.yourWeek.customPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <View style={styles.shareRow}>
            <Text style={styles.shareLabel}>{t("stats.yourWeek.shareToggle")}</Text>
            <Switch
              value={shareWithFriends}
              onValueChange={onChangeSharing}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <PrimaryButton
            label={busy ? t("stats.yourWeek.saving") : t("stats.yourWeek.saveGoal")}
            onPress={() => void onSave()}
            disabled={busy}
          />
          <Pressable style={styles.modalCancel} onPress={onClose}>
            <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
