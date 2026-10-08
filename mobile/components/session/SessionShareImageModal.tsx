import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import type { TFunction } from "i18next";
import { type ComponentRef, type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { ShareCard } from "../../features/sessions/share/ShareCard";
import {
  SHARE_EXPORT_HEIGHT,
  SHARE_EXPORT_WIDTH,
  sessionShareData,
} from "../../features/sessions/share/sessionShareData";
import { TEMPLATE_IDS, type TemplateId } from "../../features/sessions/share/types";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";
import { PrimaryButton } from "../ui/PrimaryButton";

type Props = {
  visible: boolean;
  onClose: () => void;
  session: SessionDto;
  insights?: SessionDetailInsightsDto | null;
  focusScore?: number | null;
  producerName?: string;
};

const TEMPLATE_LABEL_KEYS: Record<TemplateId, string> = {
  photo: "sessionInsights.shareTemplatePhoto",
  transparent: "sessionInsights.shareTemplateTransparent",
  black: "sessionInsights.shareTemplateBlack",
  timeline: "sessionInsights.shareTemplateTimeline",
  isometric: "sessionInsights.shareTemplateIsometric",
  echo: "sessionInsights.shareTemplateEcho",
};

const PREVIEW_WIDTH = 196;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (SHARE_EXPORT_HEIGHT / SHARE_EXPORT_WIDTH);
const CARD_READY_TIMEOUT_MS = 4000;

/**
 * Points that rasterize to exactly 1080 × 1920 pixels at the screen scale.
 * iOS view-shot reads width/height options as points, so the size must come from the view itself.
 */
function captureSizeInPoints() {
  const scale = PixelRatio.get();
  return { width: SHARE_EXPORT_WIDTH / scale, height: SHARE_EXPORT_HEIGHT / scale };
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Mounts the export card only while sharing, so picking a template redraws one small preview.
 * Resolves once the card has laid out and, for Photo, once the chosen image has loaded.
 */
function useCardReadiness(template: TemplateId) {
  const state = useRef({ layout: false, photo: false, resolve: null as null | (() => void) });

  const settleIfReady = useCallback(() => {
    const current = state.current;
    if (!current.layout || (template === "photo" && !current.photo)) return;
    current.resolve?.();
    current.resolve = null;
  }, [template]);

  const waitForCard = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        state.current = { layout: false, photo: false, resolve };
        setTimeout(() => {
          if (!state.current.resolve) return;
          state.current.resolve = null;
          reject(new Error("card-not-ready"));
        }, CARD_READY_TIMEOUT_MS);
      }),
    [],
  );

  const onCardLayout = useCallback(() => {
    state.current.layout = true;
    settleIfReady();
  }, [settleIfReady]);

  const onPhotoLoad = useCallback(() => {
    state.current.photo = true;
    settleIfReady();
  }, [settleIfReady]);

  return { waitForCard, onCardLayout, onPhotoLoad };
}

function useSessionShareExport(
  shotRef: RefObject<ComponentRef<typeof ViewShot> | null>,
  t: TFunction,
  waitForCard: () => Promise<void>,
) {
  const [busy, setBusy] = useState(false);
  const captureAndShare = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("sessionInsights.shareFailedTitle"), t("sessionInsights.shareUnavailableBody"));
      return;
    }
    const cardReady = waitForCard();
    setBusy(true);
    try {
      await cardReady;
      await nextFrame();
      await nextFrame();
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        Alert.alert(
          t("sessionInsights.shareExportFailedTitle"),
          t("sessionInsights.shareExportFailedBody"),
        );
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          t("sessionInsights.shareUnavailableTitle"),
          t("sessionInsights.shareUnavailableBody"),
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: t("sessionInsights.shareDialogTitle"),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message !== "card-not-ready"
          ? caught.message
          : t("sessionInsights.shareExportFailedBody");
      Alert.alert(t("sessionInsights.shareFailedTitle"), message);
    } finally {
      setBusy(false);
    }
  }, [shotRef, t, waitForCard]);
  return { busy, captureAndShare };
}

function SessionTemplatePicker({
  t,
  selected,
  onSelect,
  disabled,
}: {
  t: TFunction;
  selected: TemplateId;
  onSelect: (template: TemplateId) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.chips}>
      {TEMPLATE_IDS.map((id) => {
        const label = t(TEMPLATE_LABEL_KEYS[id]);
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: selected === id, disabled }}
            disabled={disabled}
            style={[styles.chip, selected === id && styles.chipOn]}
            onPress={() => {
              if (selected === id) return;
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

export function SessionShareImageModal(props: Props) {
  const { t } = useTranslation();
  const shotRef = useRef<ComponentRef<typeof ViewShot> | null>(null);
  const [template, setTemplate] = useState<TemplateId>("black");
  const [photoUri, setPhotoUri] = useState<string>();
  const [transparentText, setTransparentText] = useState<"white" | "black">("white");
  const [photoPosition, setPhotoPosition] = useState<"top" | "bottom">("bottom");
  const { waitForCard, onCardLayout, onPhotoLoad } = useCardReadiness(template);
  const { busy, captureAndShare } = useSessionShareExport(shotRef, t, waitForCard);
  const captureSize = captureSizeInPoints();
  const { visible, onClose, session, producerName } = props;
  const shareSession = useMemo(
    () => sessionShareData(session, producerName, t),
    [session, producerName, t],
  );
  const options = useMemo(
    () => ({ template, accent: colors.primary, transparentText, photoPosition }),
    [template, transparentText, photoPosition],
  );
  const photoMissing = template === "photo" && !photoUri;

  const pickPhoto = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch {
      Alert.alert(t("sessionInsights.shareFailedTitle"), t("sessionInsights.shareUnexpectedBody"));
    }
  }, [t]);

  const share = useCallback(() => {
    if (photoMissing) {
      Alert.alert(t("sessionInsights.shareExportFailedTitle"), t("sessionInsights.sharePhotoRequired"));
      return;
    }
    void captureAndShare();
  }, [captureAndShare, photoMissing, t]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t("sessionInsights.shareModalTitle")}</Text>
          <Text style={styles.sub}>{t("sessionInsights.shareModalSubtitle")}</Text>

          <SessionTemplatePicker t={t} selected={template} onSelect={setTemplate} disabled={busy} />
          {template === "photo" ? (
            <View style={styles.chips}>
              <Pressable accessibilityRole="button" style={styles.chip} onPress={() => void pickPhoto()}>
                <Text style={styles.chipTxt}>
                  {photoUri ? t("sessionInsights.shareChangePhoto") : t("sessionInsights.sharePickPhoto")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.chip, photoPosition === "bottom" && styles.chipOn]}
                onPress={() => setPhotoPosition("bottom")}
              >
                <Text style={styles.chipTxt}>{t("sessionInsights.shareOverlayBottom")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.chip, photoPosition === "top" && styles.chipOn]}
                onPress={() => setPhotoPosition("top")}
              >
                <Text style={styles.chipTxt}>{t("sessionInsights.shareOverlayTop")}</Text>
              </Pressable>
            </View>
          ) : null}
          {template === "transparent" ? (
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="button"
                style={[styles.chip, transparentText === "white" && styles.chipOn]}
                onPress={() => setTransparentText("white")}
              >
                <Text style={styles.chipTxt}>{t("sessionInsights.shareTextWhite")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.chip, transparentText === "black" && styles.chipOn]}
                onPress={() => setTransparentText("black")}
              >
                <Text style={styles.chipTxt}>{t("sessionInsights.shareTextBlack")}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.previewStage}>
            <View
              style={[
                styles.previewClip,
                template === "transparent" && transparentText === "black" && styles.previewClipLight,
              ]}
            >
              <ShareCard
                session={shareSession}
                options={options}
                width={PREVIEW_WIDTH}
                photoUri={photoUri}
              />
            </View>
          </View>

          <PrimaryButton
            label={busy ? t("sessionInsights.sharePngBusy") : t("sessionInsights.sharePngCta")}
            onPress={share}
            loading={busy}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("sessionInsights.shareClose")}
            style={styles.closeGhost}
            onPress={onClose}
            disabled={busy}
          >
            <Text style={styles.closeGhostTxt}>{t("sessionInsights.shareClose")}</Text>
          </Pressable>

          {busy ? (
            <View style={[styles.hiddenShot, captureSize]} collapsable={false} pointerEvents="none">
              <ViewShot
                ref={shotRef}
                options={{ format: "png", quality: 1, result: "tmpfile" }}
                style={[styles.shot, captureSize]}
              >
                <ShareCard
                  session={shareSession}
                  options={options}
                  width={captureSize.width}
                  photoUri={photoUri}
                  onLayout={onCardLayout}
                  onPhotoLoad={onPhotoLoad}
                />
              </ViewShot>
            </View>
          ) : null}
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
    maxHeight: "92%",
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
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
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
  },
  previewClipLight: { backgroundColor: "#D9D9D9" },
  closeGhost: { alignItems: "center", paddingVertical: spacing.md },
  closeGhostTxt: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold },
  hiddenShot: {
    position: "absolute",
    left: -8000,
    top: 0,
  },
  shot: { backgroundColor: "transparent" },
});
