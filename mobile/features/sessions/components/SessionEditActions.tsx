import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type SessionEditActionProps = {
  onDelete: () => void;
};

export function SessionDeleteAction({ onDelete }: SessionEditActionProps) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.deleteButton} onPress={onDelete}>
      <Text style={styles.deleteText}>{t("sessionDetail.deleteSession")}</Text>
    </Pressable>
  );
}

export function SessionEditFooter({
  busy,
  onSave,
  onDelete,
}: SessionEditActionProps & { busy: boolean; onSave: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.footer}>
      <PrimaryButton label={t("sessionDetail.saveChanges")} onPress={onSave} loading={busy} />
      <Pressable style={styles.compactDeleteButton} onPress={onDelete}>
        <Text style={styles.deleteText}>{t("sessionDetail.deleteSession")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  deleteButton: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.1)",
  },
  compactDeleteButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm,
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.1)",
  },
  deleteText: { color: colors.danger, fontFamily: fontFamily.bodyBold, ...typography.body },
});
