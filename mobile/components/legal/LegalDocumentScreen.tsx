import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { ScreenHeader } from "../ui/ScreenHeader";

type LegalDoc = "privacy" | "terms";

type Block = { heading: string; body: string };

export function LegalDocumentScreen({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation();
  const router = useRouter();
  const prefix = `legal.${doc}` as const;
  const blocks = t(`${prefix}.blocks`, { returnObjects: true }) as Block[];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.headerWrap}>
        <ScreenHeader
          title={t(`${prefix}.screenTitle`)}
          subtitle={t(`${prefix}.updated`)}
          actionLabel={t("common.back")}
          onActionPress={() => router.replace("/(tabs)/profile")}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t(`${prefix}.intro`)}</Text>
        {Array.isArray(blocks)
          ? blocks.map((b, i) => (
              <View key={`${doc}-${i}`} style={styles.section}>
                <Text style={styles.heading}>{b.heading}</Text>
                <Text style={styles.body}>{b.body}</Text>
              </View>
            ))
          : null}
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
  updated: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    marginBottom: spacing.md,
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
});
