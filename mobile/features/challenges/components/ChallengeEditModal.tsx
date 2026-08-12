import { useTranslation } from "react-i18next";
import { Modal, Pressable, Text, TextInput } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import { challengeDetailStyles as styles } from "../challengeDetail.styles";
import type { ChallengeDetailController } from "../hooks/useChallengeDetail";

type Props = { detail: ChallengeDetailController };

export function ChallengeEditModal({ detail }: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={detail.editOpen}
      animationType="slide"
      transparent
      onRequestClose={detail.closeEdit}
    >
      <Pressable style={styles.modalBackdrop} onPress={detail.closeEdit}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("friendsScreen.editChallengeTitle")}</Text>
          <Text style={styles.modalHint}>{t("friendsScreen.editChallengeHint")}</Text>
          <ChallengeEditField
            label={t("friendsScreen.challengeTitleLabel")}
            value={detail.editTitle}
            onChange={detail.setEditTitle}
            placeholder={t("friendsScreen.challengeTitlePlaceholder")}
          />
          <ChallengeEditField
            label={t("friendsScreen.goalTargetLabel")}
            value={detail.editTarget}
            onChange={detail.setEditTarget}
            placeholder={t("friendsScreen.challengeTargetPlaceholder")}
            numeric
          />
          <ChallengeEditField
            label={t("friendsScreen.goalDurationLabel")}
            value={detail.editDuration}
            onChange={detail.setEditDuration}
            placeholder={t("friendsScreen.challengeDurationPlaceholder")}
            numeric
          />
          <PrimaryButton
            label={detail.editBusy ? t("friendsScreen.loading") : t("friendsScreen.saveChallenge")}
            onPress={() => void detail.submitEdit()}
            disabled={detail.editBusy}
          />
          <Pressable style={styles.modalCancel} onPress={detail.closeEdit}>
            <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  numeric?: boolean;
};

function ChallengeEditField({ label, value, onChange, placeholder, numeric }: FieldProps) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "number-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
    </>
  );
}
