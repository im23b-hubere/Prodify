import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text } from "react-native";

import { PrimaryButton } from "./ui/PrimaryButton";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";

const KEY = "prodify_tutorial_v1";

export function TutorialOverlay() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(KEY);
        if (!cancelled && v !== "1") setVisible(true);
      } catch {
        if (!cancelled) setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await SecureStore.setItemAsync(KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t("tutorialOverlay.title")}</Text>
          <Text style={styles.body}>
            {t("tutorialOverlay.bodyPrefix")} <Text style={styles.bold}>{t("tutorialOverlay.startSessionCta")}</Text>{" "}
            {t("tutorialOverlay.bodyMiddle")}
            {"\n\n"}
            {t("tutorialOverlay.bodySuffix")} <Text style={styles.bold}>{t("tutorialOverlay.stopSessionCta")}</Text>{" "}
            {t("tutorialOverlay.bodyEnd")}
          </Text>
          <PrimaryButton label={t("tutorialOverlay.gotIt")} onPress={dismiss} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
  },
  bold: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
});
