import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";
import {
  SessionShareStoryCard,
  STORY_CAPTURE_HEIGHT,
  STORY_CAPTURE_WIDTH,
  type ShareTemplateId,
} from "./SessionShareStoryCard";

type Props = {
  visible: boolean;
  onClose: () => void;
  session: SessionDto;
  insights?: SessionDetailInsightsDto | null;
  focusScore?: number | null;
  producerName?: string;
};

const TEMPLATE_IDS: ShareTemplateId[] = ["minimal", "bold", "gradient"];

const TEMPLATE_LABEL_KEYS: Record<ShareTemplateId, string> = {
  minimal: "sessionInsights.shareTemplateMinimal",
  bold: "sessionInsights.shareTemplateBold",
  gradient: "sessionInsights.shareTemplateGradient",
};

const PREVIEW_SCALE = 0.68;

export function SessionShareImageModal({
  visible,
  onClose,
  session,
  insights,
  focusScore,
  producerName,
}: Props) {
  const { t } = useTranslation();
  const shotRef = useRef<ViewShot | null>(null);
  const [template, setTemplate] = useState<ShareTemplateId>("gradient");
  const [busy, setBusy] = useState(false);

  const templates = useMemo(
    () =>
      TEMPLATE_IDS.map((id) => ({
        id,
        label: t(TEMPLATE_LABEL_KEYS[id]),
      })),
    [t],
  );

  const typeLabel = useMemo(
    () => sessionTypeLabel(String(session.session_type), t),
    [session.session_type, t],
  );
  const durationLabel = formatDurationWords(session.duration_seconds ?? 0);
  const safeFocusScore = Math.max(
    0,
    Math.min(100, Math.round(insights?.focus_score ?? focusScore ?? session.focus_score ?? 0)),
  );

  const captureAndShare = useCallback(async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 160));
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Alert.alert(
          t("sessionInsights.shareExportFailedTitle"),
          t("sessionInsights.shareExportFailedBody"),
        );
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: t("sessionInsights.shareDialogTitle"),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } else {
        Alert.alert(
          t("sessionInsights.shareUnavailableTitle"),
          t("sessionInsights.shareUnavailableBody"),
        );
      }
    } catch (e) {
      Alert.alert(
        t("sessionInsights.shareFailedTitle"),
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
          <Text style={styles.title}>{t("sessionInsights.shareModalTitle")}</Text>
          <Text style={styles.sub}>{t("sessionInsights.shareModalSubtitle")}</Text>

          <View style={styles.chips}>
            {templates.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, template === item.id && styles.chipOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setTemplate(item.id);
                }}
              >
                <Text style={[styles.chipTxt, template === item.id && styles.chipTxtOn]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.previewStage}>
            <View
              style={[
                styles.previewClip,
                {
                  width: STORY_CAPTURE_WIDTH * PREVIEW_SCALE,
                  height: STORY_CAPTURE_HEIGHT * PREVIEW_SCALE,
                },
              ]}
            >
              <View
                style={{
                  width: STORY_CAPTURE_WIDTH,
                  height: STORY_CAPTURE_HEIGHT,
                  transform: [{ scale: PREVIEW_SCALE }],
                }}
              >
                <SessionShareStoryCard
                  template={template}
                  sessionType={typeLabel}
                  durationLabel={durationLabel}
                  focusScore={safeFocusScore}
                  producerName={producerName}
                />
              </View>
            </View>
          </View>

          <PrimaryButton
            label={
              busy ? t("sessionInsights.sharePngBusy") : t("sessionInsights.sharePngCta")
            }
            onPress={captureAndShare}
            loading={busy}
          />

          <Pressable style={styles.closeGhost} onPress={onClose} disabled={busy}>
            <Text style={styles.closeGhostTxt}>{t("sessionInsights.shareClose")}</Text>
          </Pressable>

          <View style={styles.hiddenShot} collapsable={false} pointerEvents="none">
            <ViewShot
              ref={shotRef}
              options={{ format: "png", quality: 1 }}
              style={styles.shotInner}
            >
              <SessionShareStoryCard
                template={template}
                sessionType={typeLabel}
                durationLabel={durationLabel}
                focusScore={safeFocusScore}
                producerName={producerName}
              />
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
  previewStage: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
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
    width: STORY_CAPTURE_WIDTH,
    height: STORY_CAPTURE_HEIGHT,
    left: -5000,
    top: 0,
  },
  shotInner: { width: STORY_CAPTURE_WIDTH, height: STORY_CAPTURE_HEIGHT },
});
