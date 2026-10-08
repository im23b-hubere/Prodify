import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import type { TFunction } from "i18next";
import { ArrowUpDown, Check, ImagePlus } from "lucide-react-native";
import {
  type ComponentRef,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Polyline } from "react-native-svg";
import ViewShot from "react-native-view-shot";

import { MONO_LIGHT_BACKGROUND } from "../../features/sessions/share/backgrounds";
import { ShareCard } from "../../features/sessions/share/ShareCard";
import {
  SHARE_EXPORT_HEIGHT,
  SHARE_EXPORT_WIDTH,
  sessionShareData,
} from "../../features/sessions/share/sessionShareData";
import type { CardOptions, TemplateId } from "../../features/sessions/share/types";
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

/** Swipe order; Isometric is the default look and comes first. */
const TEMPLATE_ORDER: readonly TemplateId[] = [
  "isometric",
  "mono",
  "timeline",
  "echo",
  "transparent",
  "photo",
];

const TEMPLATE_LABEL_KEYS: Record<TemplateId, string> = {
  photo: "sessionInsights.shareTemplatePhoto",
  transparent: "sessionInsights.shareTemplateTransparent",
  mono: "sessionInsights.shareTemplateMono",
  timeline: "sessionInsights.shareTemplateTimeline",
  isometric: "sessionInsights.shareTemplateIsometric",
  echo: "sessionInsights.shareTemplateEcho",
};

/** Templates without options never change, so their cards never redraw. */
const PLAIN_OPTIONS = new Map<TemplateId, CardOptions>(
  TEMPLATE_ORDER.map((id) => [id, { template: id, accent: colors.primary }]),
);
const INACTIVE_DOT = "rgba(255,255,255,0.22)";
const DOT_SIZE = 6;
const ACTIVE_DOT_WIDTH = 18;

const CARD_RATIO = SHARE_EXPORT_HEIGHT / SHARE_EXPORT_WIDTH;
/** Used until the sheet has measured itself; the preview then grows into the free height. */
const FALLBACK_PREVIEW_WIDTH = 220;
const MIN_PREVIEW_WIDTH = 160;
/** Room on each side of the card for the previous / next arrows. */
const ARROW_GUTTER = 52;
const CARD_READY_TIMEOUT_MS = 4000;
/** The sheet stops short of the top so the dimmed screen behind shows it can be dismissed. */
const SHEET_HEIGHT_RATIO = 0.86;
const SHEET_OPEN_TIMING = { duration: 340, easing: Easing.bezier(0.23, 1, 0.32, 1) };
const SHEET_CLOSE_TIMING = { duration: 240, easing: Easing.bezier(0.4, 0, 1, 1) };
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

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
 * Mounts the export card only while sharing, so swiping redraws only the small previews.
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

/**
 * Slides the sheet up on open, and closes it on a backdrop tap, a grabber tap or a drag down far
 * or fast enough; a shorter drag springs back.
 */
function useSwipeDownSheet(visible: boolean, height: number, onClose: () => void) {
  const offset = useSharedValue(height);

  useEffect(() => {
    if (!visible) return;
    offset.value = height;
    offset.value = withTiming(0, SHEET_OPEN_TIMING);
  }, [height, offset, visible]);

  const close = useCallback(() => {
    offset.value = withTiming(height, SHEET_CLOSE_TIMING, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [height, offset, onClose]);

  // Horizontal drags fail this gesture, so swiping between styles still belongs to the carousel.
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-16, 16])
        .onUpdate((event) => {
          offset.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
            offset.value = withTiming(height, SHEET_CLOSE_TIMING, (finished) => {
              if (finished) runOnJS(onClose)();
            });
          } else {
            offset.value = withSpring(0, { damping: 24, stiffness: 260 });
          }
        }),
    [height, offset, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, height], [1, 0], Extrapolation.CLAMP),
  }));

  return { close, drag, sheetStyle, backdropStyle };
}

export function SessionShareImageModal(props: Props) {
  const { t } = useTranslation();
  const shotRef = useRef<ComponentRef<typeof ViewShot> | null>(null);
  const carouselRef = useRef<Animated.ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [template, setTemplate] = useState<TemplateId>(TEMPLATE_ORDER[0]!);
  // Cards are drawn once they come near the screen and kept, so opening the sheet draws two.
  const [drawn, setDrawn] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  const [photoUri, setPhotoUri] = useState<string>();
  const [monoTheme, setMonoTheme] = useState<"dark" | "light">("dark");
  const [photoPosition, setPhotoPosition] = useState<"top" | "bottom">("bottom");
  const { waitForCard, onCardLayout, onPhotoLoad } = useCardReadiness(template);
  const { busy, captureAndShare } = useSessionShareExport(shotRef, t, waitForCard);
  const captureSize = captureSizeInPoints();
  const { visible, onClose, session, producerName } = props;
  const sheetHeight = Math.round(useWindowDimensions().height * SHEET_HEIGHT_RATIO);
  const sheet = useSwipeDownSheet(visible, sheetHeight, onClose);
  // Every open starts fresh: on the first style, like the carousel, which remounts on the first
  // card, and without the photo picked last time.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTemplate(TEMPLATE_ORDER[0]!);
      setPhotoUri(undefined);
    }
  }
  const shareSession = useMemo(
    () => sessionShareData(session, producerName, t),
    [session, producerName, t],
  );
  const monoOptions = useMemo<CardOptions>(
    () => ({ template: "mono", accent: colors.primary, monoTheme }),
    [monoTheme],
  );
  const photoOptions = useMemo<CardOptions>(
    () => ({ template: "photo", accent: colors.primary, photoPosition }),
    [photoPosition],
  );
  const optionsFor = useCallback(
    (id: TemplateId): CardOptions =>
      id === "mono" ? monoOptions : id === "photo" ? photoOptions : PLAIN_OPTIONS.get(id)!,
    [monoOptions, photoOptions],
  );
  const photoMissing = template === "photo" && !photoUri;
  const templateIndex = TEMPLATE_ORDER.indexOf(template);
  // The sheet's height is fixed, so the card grows into the free space instead of
  // leaving it empty, while staying narrow enough to fit the page.
  const previewWidth = useMemo(() => {
    if (stageHeight <= 0 || pageWidth <= 0) return FALLBACK_PREVIEW_WIDTH;
    const byHeight = stageHeight / CARD_RATIO;
    const byWidth = pageWidth - ARROW_GUTTER * 2;
    return Math.max(MIN_PREVIEW_WIDTH, Math.floor(Math.min(byHeight, byWidth)));
  }, [pageWidth, stageHeight]);

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

  /** The page under the user's finger: name, options and neighbours update as it changes. */
  const settlePage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(TEMPLATE_ORDER.length - 1, index));
    setDrawn((current) => {
      if ([clamped - 1, clamped, clamped + 1].every((page) => current.has(page))) return current;
      return new Set([...current, clamped - 1, clamped, clamped + 1]);
    });
    setTemplate((current) => {
      const next = TEMPLATE_ORDER[clamped]!;
      if (next !== current) Haptics.selectionAsync().catch(() => undefined);
      return next;
    });
  }, []);

  const scrollX = useSharedValue(0);
  const pageWidthValue = useSharedValue(0);
  const nearestPage = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      if (pageWidthValue.value <= 0) return;
      const page = Math.round(event.contentOffset.x / pageWidthValue.value);
      if (page !== nearestPage.value) {
        nearestPage.value = page;
        runOnJS(settlePage)(page);
      }
    },
  });

  // The carousel remounts at the first card on every open, so the dots start over with it
  // instead of pointing at the style picked last time. This runs on open, not on close: the
  // closing carousel can still report its old position after the sheet is gone.
  useLayoutEffect(() => {
    if (!visible) return;
    scrollX.value = 0;
    nearestPage.value = 0;
  }, [nearestPage, scrollX, visible]);

  const showTemplate = useCallback(
    (id: TemplateId) => {
      const index = TEMPLATE_ORDER.indexOf(id);
      settlePage(index);
      carouselRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    },
    [pageWidth, settlePage],
  );

  const onSwipeEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth > 0) settlePage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
    },
    [pageWidth, settlePage],
  );

  const share = useCallback(() => {
    if (photoMissing) {
      void pickPhoto();
      return;
    }
    void captureAndShare();
  }, [captureAndShare, photoMissing, pickPhoto]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={sheet.close}
    >
      {/* Modals are a separate native hierarchy on iOS — gestures need their own root here. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, sheet.backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={sheet.close}
            accessibilityRole="button"
            accessibilityLabel={t("sessionInsights.shareCloseA11y")}
          />
        </Animated.View>
        <GestureDetector gesture={sheet.drag}>
          <Animated.View
            style={[styles.sheet, { height: sheetHeight }, sheet.sheetStyle]}
            testID="share-sheet"
          >
            <Pressable
              onPress={sheet.close}
              hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }}
              style={styles.grabberHit}
              accessibilityRole="button"
              accessibilityLabel={t("sessionInsights.shareCloseA11y")}
            >
              <View style={styles.grabber} />
            </Pressable>
            <Text style={styles.title}>{t("sessionInsights.shareModalTitle")}</Text>
            <Text style={styles.sub}>{t("sessionInsights.shareModalSubtitle")}</Text>

            <View
              style={styles.stage}
              onLayout={(event: LayoutChangeEvent) =>
                setStageHeight(Math.floor(event.nativeEvent.layout.height))
              }
            >
              <Animated.ScrollView
                ref={carouselRef}
                horizontal
                pagingEnabled
                scrollEnabled={!busy}
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={onScroll}
                onLayout={(event: LayoutChangeEvent) => {
                  const width = Math.round(event.nativeEvent.layout.width);
                  pageWidthValue.value = width;
                  setPageWidth(width);
                }}
                onMomentumScrollEnd={onSwipeEnd}
                style={styles.carousel}
                accessibilityLabel={t("sessionInsights.shareSwipeA11y")}
              >
                {TEMPLATE_ORDER.map((id, index) => (
                  <View key={id} style={[styles.page, pageWidth > 0 && { width: pageWidth }]}>
                    <TemplatePreview
                      t={t}
                      template={id}
                      width={previewWidth}
                      drawn={drawn.has(index)}
                      options={optionsFor(id)}
                      session={shareSession}
                      photoUri={id === "photo" ? photoUri : undefined}
                      onPickPhoto={pickPhoto}
                    />
                  </View>
                ))}
              </Animated.ScrollView>
              <StepArrow
                direction="previous"
                label={t("sessionInsights.sharePreviousStyle")}
                hidden={templateIndex === 0}
                disabled={busy}
                onPress={() => showTemplate(TEMPLATE_ORDER[templateIndex - 1]!)}
              />
              <StepArrow
                direction="next"
                label={t("sessionInsights.shareNextStyle")}
                hidden={templateIndex === TEMPLATE_ORDER.length - 1}
                disabled={busy}
                onPress={() => showTemplate(TEMPLATE_ORDER[templateIndex + 1]!)}
              />
            </View>

            <TemplateIndicator
              t={t}
              selected={template}
              onSelect={showTemplate}
              disabled={busy}
              scrollX={scrollX}
              pageWidth={pageWidthValue}
            />

            <View style={styles.options}>
              {template === "photo" ? (
                <PhotoOptions
                  t={t}
                  hasPhoto={Boolean(photoUri)}
                  position={photoPosition}
                  onPickPhoto={() => void pickPhoto()}
                  onFlip={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    setPhotoPosition((value) => (value === "bottom" ? "top" : "bottom"));
                  }}
                />
              ) : null}
              {template === "mono" ? (
                <MonoThemeOptions t={t} value={monoTheme} onChange={setMonoTheme} />
              ) : null}
            </View>

            <PrimaryButton
              label={
                busy
                  ? t("sessionInsights.sharePngBusy")
                  : photoMissing
                    ? t("sessionInsights.sharePickPhoto")
                    : t("sessionInsights.sharePngCta")
              }
              onPress={share}
              loading={busy}
            />

            {busy ? (
              <View
                style={[styles.hiddenShot, captureSize]}
                collapsable={false}
                pointerEvents="none"
              >
                <ViewShot
                  ref={shotRef}
                  options={{ format: "png", quality: 1, result: "tmpfile" }}
                  style={[styles.shot, captureSize]}
                >
                  <ShareCard
                    session={shareSession}
                    options={optionsFor(template)}
                    width={captureSize.width}
                    photoUri={photoUri}
                    onLayout={onCardLayout}
                    onPhotoLoad={onPhotoLoad}
                  />
                </ViewShot>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const TemplatePreview = memo(function TemplatePreview({
  t,
  template,
  width,
  drawn,
  options,
  session,
  photoUri,
  onPickPhoto,
}: {
  t: TFunction;
  template: TemplateId;
  width: number;
  drawn: boolean;
  options: CardOptions;
  session: ReturnType<typeof sessionShareData>;
  photoUri: string | undefined;
  onPickPhoto: () => Promise<void> | void;
}) {
  const size = { width, height: Math.round(width * CARD_RATIO) };
  if (!drawn) return <View style={[styles.previewClip, size]} />;
  const card = (
    <View style={[styles.previewClip, size]}>
      <ShareCard session={session} options={options} width={width} photoUri={photoUri} />
      {template === "photo" && !photoUri ? (
        // Preview only: the export never draws this prompt. It sits in the half the text
        // leaves free, so it moves down when the text is placed at the top.
        <View
          style={[
            styles.photoPrompt,
            options.photoPosition === "top"
              ? { paddingTop: size.height * 0.25 }
              : { paddingBottom: size.height * 0.25 },
          ]}
          pointerEvents="none"
        >
          <ImagePlus color={colors.textPrimary} size={28} strokeWidth={1.8} />
          <Text style={styles.photoPromptText}>{t("sessionInsights.shareTapToAddPhoto")}</Text>
        </View>
      ) : null}
    </View>
  );
  if (template !== "photo") return card;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        photoUri ? t("sessionInsights.shareChangePhoto") : t("sessionInsights.sharePickPhoto")
      }
      onPress={() => void onPickPhoto()}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
  );
});

/**
 * The current template's name above one dot per template. The dots follow the scroll position,
 * so the active one stretches and hands over to the next while the card is still moving.
 */
function TemplateIndicator({
  t,
  selected,
  onSelect,
  disabled,
  scrollX,
  pageWidth,
}: {
  t: TFunction;
  selected: TemplateId;
  onSelect: (template: TemplateId) => void;
  disabled: boolean;
  scrollX: SharedValue<number>;
  pageWidth: SharedValue<number>;
}) {
  return (
    <View style={styles.indicator}>
      <Animated.Text key={selected} entering={FadeIn.duration(160)} style={styles.indicatorName}>
        {t(TEMPLATE_LABEL_KEYS[selected])}
      </Animated.Text>
      <View style={styles.dots}>
        {TEMPLATE_ORDER.map((id, index) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={t(TEMPLATE_LABEL_KEYS[id])}
            accessibilityState={{ selected: selected === id, disabled }}
            disabled={disabled}
            hitSlop={6}
            onPress={() => onSelect(id)}
            style={styles.dotHit}
          >
            <Dot index={index} scrollX={scrollX} pageWidth={pageWidth} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Dot({
  index,
  scrollX,
  pageWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const position = pageWidth.value > 0 ? scrollX.value / pageWidth.value : 0;
    const distance = Math.min(1, Math.abs(position - index));
    return {
      width: interpolate(distance, [0, 1], [ACTIVE_DOT_WIDTH, DOT_SIZE], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(distance, [0, 1], [colors.primary, INACTIVE_DOT]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** Tap targets beside the card for people who don't think to swipe; hidden at either end. */
function StepArrow({
  direction,
  label,
  hidden,
  disabled,
  onPress,
}: {
  direction: "previous" | "next";
  label: string;
  hidden: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  if (hidden) return null;
  // A tall, thin open chevron with round caps, closer to the light geometric type than an icon.
  const points = direction === "previous" ? "13,3 3,18 13,33" : "3,3 13,18 3,33";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        direction === "previous" ? styles.arrowPrevious : styles.arrowNext,
        pressed && styles.pressed,
      ]}
    >
      <Svg width={16} height={36} viewBox="0 0 16 36">
        <Polyline
          points={points}
          fill="none"
          stroke={colors.textPrimary}
          strokeOpacity={0.72}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function PhotoOptions({
  t,
  hasPhoto,
  position,
  onPickPhoto,
  onFlip,
}: {
  t: TFunction;
  hasPhoto: boolean;
  position: "top" | "bottom";
  onPickPhoto: () => void;
  onFlip: () => void;
}) {
  return (
    <>
      <IconOption
        label={
          hasPhoto ? t("sessionInsights.shareChangePhoto") : t("sessionInsights.sharePickPhoto")
        }
        onPress={onPickPhoto}
        icon={<ImagePlus color={colors.textPrimary} size={18} strokeWidth={2} />}
      />
      <IconOption
        label={
          position === "bottom"
            ? t("sessionInsights.shareOverlayBottom")
            : t("sessionInsights.shareOverlayTop")
        }
        onPress={onFlip}
        icon={<ArrowUpDown color={colors.textPrimary} size={18} strokeWidth={2} />}
      />
    </>
  );
}

function IconOption({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconOption, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.iconOptionText}>{label}</Text>
    </Pressable>
  );
}

/** Mono's two looks, picked by colour: a black card or a warm white one. */
function MonoThemeOptions({
  t,
  value,
  onChange,
}: {
  t: TFunction;
  value: "dark" | "light";
  onChange: (value: "dark" | "light") => void;
}) {
  const swatches = [
    { id: "dark" as const, color: colors.background, label: t("sessionInsights.shareMonoDark") },
    {
      id: "light" as const,
      color: MONO_LIGHT_BACKGROUND,
      label: t("sessionInsights.shareMonoLight"),
    },
  ];
  return (
    <>
      {swatches.map((swatch) => {
        const selected = value === swatch.id;
        return (
          <Pressable
            key={swatch.id}
            accessibilityRole="button"
            accessibilityLabel={swatch.label}
            accessibilityState={{ selected }}
            hitSlop={8}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(swatch.id);
            }}
            style={[styles.swatchRing, selected && styles.swatchRingActive]}
          >
            <View style={[styles.swatch, { backgroundColor: swatch.color }]}>
              {selected ? (
                <Check
                  color={swatch.id === "light" ? "#111214" : "#ffffff"}
                  size={14}
                  strokeWidth={3}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  grabberHit: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  sub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  /** Takes every bit of height the other parts leave; the card is sized to it. */
  stage: {
    flex: 1,
    marginHorizontal: -spacing.lg,
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -28,
    width: 44,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowPrevious: { left: spacing.xs },
  arrowNext: { right: spacing.xs },
  carousel: {
    flex: 1,
  },
  page: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  previewClip: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#050505",
  },
  photoPrompt: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  photoPromptText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  indicator: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  indicatorName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  dots: { flexDirection: "row", gap: 2 },
  dotHit: { padding: 4 },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  options: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  iconOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  iconOptionText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  swatchRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchRingActive: { borderColor: colors.primary },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pressed: { opacity: 0.75 },
  hiddenShot: {
    position: "absolute",
    left: -8000,
    top: 0,
  },
  shot: { backgroundColor: "transparent" },
});
