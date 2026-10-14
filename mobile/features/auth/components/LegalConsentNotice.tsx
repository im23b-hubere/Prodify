import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { pressFeedbackStyle } from "../../../components/ui/pressFeedback";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";

/** Links stay small visually but keep Apple's 44 pt touch target. */
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

/** Every way to create an account (email, Apple, Google) passes this notice (App Review 1.2). */
export function LegalConsentNotice() {
  const { t } = useTranslation();
  const { push } = useRouter();

  return (
    <View style={styles.root}>
      <Text style={styles.notice}>{t("auth.legalConsent.notice")}</Text>
      <View style={styles.links}>
        <LegalLink label={t("auth.legalConsent.terms")} onPress={() => push("/legal/terms")} />
        <Text style={styles.separator} accessible={false}>
          ·
        </Text>
        <LegalLink label={t("auth.legalConsent.privacy")} onPress={() => push("/legal/privacy")} />
      </View>
    </View>
  );
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={LINK_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => pressFeedbackStyle(pressed, "light")}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: spacing.lg,
    gap: spacing.xs,
    alignItems: "center",
  },
  notice: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    textAlign: "center",
    ...typography.meta,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  link: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    textDecorationLine: "underline",
    ...typography.meta,
  },
  separator: {
    color: colors.textSecondary,
    opacity: 0.5,
    ...typography.meta,
  },
});
