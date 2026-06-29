import * as Haptics from "expo-haptics";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  testID?: string;
};

/** Single subtle premium upsell — shown only when relevant (see stats screen). */
export const StatsPremiumTeaser = memo(function StatsPremiumTeaser({ testID }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        router.push("/paywall");
      }}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{t("stats.premiumForecastTeaserTitle")}</Text>
        <Text style={styles.body}>{t("stats.premiumForecastTeaserBody")}</Text>
      </View>
      <Text style={styles.cta}>{t("stats.premiumForecastCta")}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(162,89,255,0.35)",
    backgroundColor: "rgba(162,89,255,0.08)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 11,
    lineHeight: 15,
  },
  cta: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
