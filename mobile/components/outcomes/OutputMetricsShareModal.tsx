import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { OutputMetricsDto } from "../../types/outcomes";
import {
  OUTPUT_SHARE_HEIGHT,
  OUTPUT_SHARE_WIDTH,
  OutputMetricsShareCard,
} from "./OutputMetricsShareCard";
import type { OutputShareTemplateId } from "./OutputMetricsShareCard";

const PREVIEW_SCALE = 0.68;

type Props = {
  visible: boolean;
  onClose: () => void;
  metrics: OutputMetricsDto;
  title: string;
  subtitle: string;
  shareLabel: string;
  closeLabel: string;
  busyLabel: string;
};

export function OutputMetricsShareModal({
  visible,
  onClose,
  metrics,
  title,
  subtitle,
  shareLabel,
  closeLabel,
  busyLabel,
}: Props) {
  const { t } = useTranslation();
  const shotRef = useRef<ViewShot | null>(null);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<OutputShareTemplateId>("gradient");

  const captureAndShare = useCallback(async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 160));
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Alert.alert(t("stats.shareProofExportFailedTitle"), t("stats.shareProofExportFailedBody"));
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: t("stats.shareProofShareDialogTitle"),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } else {
        Alert.alert(t("stats.shareProofUnavailableTitle"), t("stats.shareProofUnavailableBody"));
      }
    } catch (e) {
      Alert.alert(
        t("stats.shareProofShareFailedTitle"),
        e instanceof Error ? e.message : t("stats.shareProofUnexpectedBody"),
      );
    } finally {
      setBusy(false);
    }
  }, [t]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
          <View style={styles.chips}>
            {(
              [
                ["minimal", t("stats.shareProofTemplateMinimal")],
                ["bold", t("stats.shareProofTemplateBold")],
                ["gradient", t("stats.shareProofTemplateGradient")],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.chip, template === id && styles.chipOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setTemplate(id);
                }}
              >
                <Text style={[styles.chipTxt, template === id && styles.chipTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.previewStage}>
            <View
              style={[
                styles.previewClip,
                {
                  width: OUTPUT_SHARE_WIDTH * PREVIEW_SCALE,
                  height: OUTPUT_SHARE_HEIGHT * PREVIEW_SCALE,
                },
              ]}
            >
              <View
                style={{
                  width: OUTPUT_SHARE_WIDTH,
                  height: OUTPUT_SHARE_HEIGHT,
                  transform: [{ scale: PREVIEW_SCALE }],
                }}
              >
                <OutputMetricsShareCard metrics={metrics} template={template} />
              </View>
            </View>
          </View>

          <PrimaryButton
            label={busy ? busyLabel : shareLabel}
            onPress={captureAndShare}
            loading={busy}
          />

          <Pressable style={styles.closeGhost} onPress={onClose} disabled={busy}>
            <Text style={styles.closeGhostTxt}>{closeLabel}</Text>
          </Pressable>

          <View style={styles.hiddenShot} collapsable={false} pointerEvents="none">
            <ViewShot
              ref={shotRef}
              options={{ format: "png", quality: 1 }}
              style={styles.shotInner}
            >
              <OutputMetricsShareCard metrics={metrics} template={template} />
            </ViewShot>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "88%",
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  previewStage: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  chips: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.12)" },
  chipTxt: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  chipTxtOn: { color: colors.textPrimary },
  previewClip: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  closeGhost: { alignItems: "center", paddingVertical: spacing.md },
  closeGhostTxt: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold },
  hiddenShot: {
    position: "absolute",
    width: OUTPUT_SHARE_WIDTH,
    height: OUTPUT_SHARE_HEIGHT,
    left: -5000,
    top: 0,
  },
  shotInner: { width: OUTPUT_SHARE_WIDTH, height: OUTPUT_SHARE_HEIGHT },
});
