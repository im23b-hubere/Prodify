import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { ScreenHeader } from "../ui/ScreenHeader";

type LegalDoc = "privacy" | "terms";

type Block = { heading: string; body: string };

function parseLegalBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Block => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    return typeof o.heading === "string" && typeof o.body === "string";
  });
}

export function LegalDocumentScreen({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation();
  const router = useRouter();
  const prefix = `legal.${doc}` as const;
  const blocks = useMemo(
    () => parseLegalBlocks(t(`${prefix}.blocks`, { returnObjects: true })),
    [t, prefix],
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/profile");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerWrap}>
        <ScreenHeader
          title={t(`${prefix}.screenTitle`)}
          subtitle={t(`${prefix}.updated`)}
          actionLabel={t("common.back")}
          onActionPress={goBack}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t(`${prefix}.intro`)}</Text>
        {blocks.length > 0 ? (
          blocks.map((b, i) => (
            <View key={`${doc}-${i}`} style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>
                {b.heading}
              </Text>
              <Text style={styles.body}>{b.body}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.missing}>{t("legal.documentBodyMissing")}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
  },
  missing: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
    paddingVertical: spacing.md,
  },
});
