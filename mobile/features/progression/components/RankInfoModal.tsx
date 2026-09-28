import type { LucideIcon } from "lucide-react-native";
import { Mountain, TrendingDown, Zap } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";

type Props = {
  open: boolean;
  onClose: () => void;
};

const RULES: { icon: LucideIcon; color: string; titleKey: string; bodyKey: string }[] = [
  {
    icon: Zap,
    color: colors.primary,
    titleKey: "progression.info.earnTitle",
    bodyKey: "progression.info.earnBody",
  },
  {
    icon: Mountain,
    color: "#f5d547",
    titleKey: "progression.info.climbTitle",
    bodyKey: "progression.info.climbBody",
  },
  {
    icon: TrendingDown,
    color: colors.textSecondary,
    titleKey: "progression.info.drainTitle",
    bodyKey: "progression.info.drainBody",
  },
];

/** "How ranks work" explainer behind the (i) button on the rank path. */
export function RankInfoModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>{t("progression.info.title")}</Text>
          <View style={styles.rules}>
            {RULES.map(({ icon: Icon, color, titleKey, bodyKey }) => (
              <View key={titleKey} style={styles.rule}>
                <View style={styles.ruleIcon}>
                  <Icon color={color} size={18} strokeWidth={2.4} />
                </View>
                <View style={styles.ruleCopy}>
                  <Text style={styles.ruleTitle}>{t(titleKey)}</Text>
                  <Text style={styles.ruleBody}>{t(bodyKey)}</Text>
                </View>
              </View>
            ))}
          </View>
          <PrimaryButton label={t("progression.info.close")} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  rules: {
    gap: spacing.md,
  },
  rule: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleCopy: {
    flex: 1,
    gap: 2,
  },
  ruleTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  ruleBody: {
    color: colors.textSecondary,
    ...typography.meta,
  },
});
