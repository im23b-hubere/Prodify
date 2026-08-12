import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { type RefObject, useCallback, useRef, useState } from "react";
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

const TEMPLATE_LABEL_KEYS: Record<OutputShareTemplateId, string> = {
  minimal: "stats.shareProofTemplateMinimal",
  bold: "stats.shareProofTemplateBold",
  gradient: "stats.shareProofTemplateGradient",
};

function useOutputShareExport(shotRef: RefObject<ViewShot | null>) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const captureAndShare = useCallback(async () => {
    setBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 160));
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Alert.alert(t("stats.shareProofExportFailedTitle"), t("stats.shareProofExportFailedBody"));
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t("stats.shareProofUnavailableTitle"), t("stats.shareProofUnavailableBody"));
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: t("stats.shareProofShareDialogTitle"),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : t("stats.shareProofUnexpectedBody");
      Alert.alert(t("stats.shareProofShareFailedTitle"), message);
    } finally {
      setBusy(false);
    }
  }, [shotRef, t]);
  return { busy, captureAndShare };
}

function TemplatePicker({
  selected,
  onSelect,
}: {
  selected: OutputShareTemplateId;
  onSelect: (template: OutputShareTemplateId) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.chips}>
      {(Object.keys(TEMPLATE_LABEL_KEYS) as OutputShareTemplateId[]).map((id) => {
        const label = t(TEMPLATE_LABEL_KEYS[id]);
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.chip, selected === id && styles.chipOn]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onSelect(id);
            }}
          >
            <Text style={[styles.chipTxt, selected === id && styles.chipTxtOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SharePreview({
  metrics,
  template,
}: Pick<Props, "metrics"> & { template: OutputShareTemplateId }) {
  return (
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
  );
}

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
  const shotRef = useRef<ViewShot | null>(null);
  const [template, setTemplate] = useState<OutputShareTemplateId>("gradient");
  const { busy, captureAndShare } = useOutputShareExport(shotRef);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
          <TemplatePicker selected={template} onSelect={setTemplate} />
          <SharePreview metrics={metrics} template={template} />

          <PrimaryButton
            label={busy ? busyLabel : shareLabel}
            onPress={captureAndShare}
            loading={busy}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            style={styles.closeGhost}
            onPress={onClose}
            disabled={busy}
          >
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
