import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { memo, useCallback, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { TextButton } from "../../components/ui/TextButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import type { WrappedSlide } from "./wrappedSlides";
import type { WeeklyShareTemplateId } from "./WeeklyWrappedShareCard";

type Props = {
  slides: WrappedSlide[];
  t: (key: string, opts?: Record<string, unknown>) => string;
  onClose: () => void;
  showGenerate?: boolean;
  generateBusy?: boolean;
  generateError?: string | null;
  onGenerate?: () => void;
  showShare?: boolean;
  shareBusy?: boolean;
  shareTemplate: WeeklyShareTemplateId;
  onShareTemplateChange: (template: WeeklyShareTemplateId) => void;
  onShareCard?: () => void;
  onShareText?: () => void;
  onSetGoals?: () => void;
  onStartSession?: () => void;
  statsWarning?: string | null;
};

function WrappedSlideCard({ slide, width, height }: { slide: WrappedSlide; width: number; height: number }) {
  const isStat = slide.kind === "stat" || slide.kind === "intro";
  const isQuote = slide.kind === "quote";

  return (
    <LinearGradient
      colors={slide.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.slide, { width, minHeight: height }]}
    >
      <View style={styles.slideInner}>
        {slide.kicker ? <Text style={styles.kicker}>{slide.kicker}</Text> : null}
        <Text
          style={[
            styles.title,
            slide.kind === "intro" && styles.titleIntro,
            slide.kind === "stat" && styles.titleStat,
            slide.kind === "quote" && styles.titleQuote,
            slide.kind === "outro" && styles.titleOutro,
            slide.kind === "empty" && styles.titleEmpty,
          ]}
          numberOfLines={isQuote ? 8 : 3}
        >
          {slide.title}
        </Text>
        {slide.subtitle ? (
          <Text style={[styles.subtitle, isStat && styles.subtitleStat]} numberOfLines={isQuote ? 2 : 3}>
            {slide.subtitle}
          </Text>
        ) : null}
        {slide.footnote ? (
          <Text style={styles.footnote} numberOfLines={3}>
            {slide.footnote}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export const WeeklyWrappedViewer = memo(function WeeklyWrappedViewer({
  slides,
  t,
  onClose,
  showGenerate = false,
  generateBusy = false,
  generateError = null,
  onGenerate,
  showShare = false,
  shareBusy = false,
  shareTemplate,
  onShareTemplateChange,
  onShareCard,
  onShareText,
  onSetGoals,
  onStartSession,
  statsWarning,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<WrappedSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next !== activeIndex && next >= 0 && next < slides.length) {
        setActiveIndex(next);
      }
    },
    [activeIndex, slides.length, width],
  );

  const goNext = useCallback(() => {
    if (activeIndex >= slides.length - 1) return;
    const next = activeIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
    Haptics.selectionAsync().catch(() => undefined);
  }, [activeIndex, slides.length]);

  const goPrev = useCallback(() => {
    if (activeIndex <= 0) return;
    const prev = activeIndex - 1;
    listRef.current?.scrollToIndex({ index: prev, animated: true });
    setActiveIndex(prev);
    Haptics.selectionAsync().catch(() => undefined);
  }, [activeIndex]);

  const slideHeight = Math.max(420, height - insets.top - insets.bottom);
  const activeSlide = slides[activeIndex];
  const isOutro = activeSlide?.kind === "outro";
  const isEmpty = activeSlide?.kind === "empty";

  return (
    <View style={styles.root} testID="weekly-wrapped-viewer">
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.topRow}>
          <View style={styles.progressRow}>
            {slides.map((slide, index) => (
              <View
                key={slide.id}
                style={[styles.progressSegment, index <= activeIndex && styles.progressSegmentActive]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("weeklyRecap.close")}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onClose();
            }}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <X color={colors.textPrimary} size={20} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <WrappedSlideCard slide={item} width={width} height={slideHeight} />
        )}
      />

      <Pressable style={[styles.tapPrev, { top: insets.top + 56 }]} onPress={goPrev} />
      <Pressable style={[styles.tapNext, { top: insets.top + 56 }]} onPress={goNext} />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {!isOutro && !isEmpty ? (
          <Text style={styles.swipeHint}>{t("weeklyRecap.wrappedSwipeHint")}</Text>
        ) : null}

        {isEmpty && onStartSession ? (
          <PrimaryButton label={t("weeklyRecap.emptyCta")} onPress={onStartSession} />
        ) : null}

        {statsWarning && activeIndex === 0 ? (
          <Text style={styles.warningText}>{statsWarning}</Text>
        ) : null}

        {showGenerate && onGenerate && activeIndex === 0 ? (
          <View style={styles.actionBlock}>
            <PrimaryButton
              label={generateBusy ? t("weeklyRecap.generating") : t("weeklyRecap.generateCta")}
              loading={generateBusy}
              onPress={onGenerate}
            />
            {generateError ? <Text style={styles.errorText}>{generateError}</Text> : null}
          </View>
        ) : null}

        {isOutro && showShare ? (
          <View style={styles.actionBlock}>
            <View style={styles.templateRow}>
              {(
                [
                  ["minimal", t("weeklyRecap.templateMinimal")],
                  ["gradient", t("weeklyRecap.templateGradient")],
                  ["bold", t("weeklyRecap.templateBold")],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  style={[styles.templateChip, shareTemplate === id && styles.templateChipActive]}
                  onPress={() => onShareTemplateChange(id)}
                >
                  <Text
                    style={[
                      styles.templateChipText,
                      shareTemplate === id && styles.templateChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {onShareCard ? (
              <PrimaryButton
                label={shareBusy ? t("weeklyRecap.shareBusy") : t("weeklyRecap.shareWeekCardCta")}
                disabled={shareBusy}
                onPress={onShareCard}
              />
            ) : null}
            {onShareText ? (
              <SecondaryButton label={t("weeklyRecap.shareCta")} onPress={onShareText} />
            ) : null}
            {onSetGoals ? (
              <TextButton label={t("weeklyRecap.setGoals")} onPress={onSetGoals} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressSegmentActive: {
    backgroundColor: "#fff",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  slide: {
    justifyContent: "center",
  },
  slideInner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 88,
    paddingBottom: 160,
    gap: spacing.sm,
  },
  kicker: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#fff",
    fontFamily: fontFamily.heading,
  },
  titleIntro: {
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
  },
  titleStat: {
    fontSize: 92,
    lineHeight: 96,
    letterSpacing: -2.5,
  },
  titleQuote: {
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  titleOutro: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  titleEmpty: {
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    maxWidth: 320,
  },
  subtitleStat: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 18,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  footnote: {
    marginTop: spacing.sm,
    color: "rgba(255,255,255,0.62)",
    fontFamily: fontFamily.body,
    ...typography.caption,
    maxWidth: 320,
    lineHeight: 20,
  },
  tapPrev: {
    position: "absolute",
    left: 0,
    top: 88,
    bottom: 160,
    width: "34%",
    zIndex: 5,
  },
  tapNext: {
    position: "absolute",
    right: 0,
    top: 88,
    bottom: 160,
    width: "66%",
    zIndex: 5,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    zIndex: 8,
  },
  swipeHint: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  actionBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  templateRow: {
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
  },
  templateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  templateChipActive: {
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  templateChipText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  templateChipTextActive: {
    color: "#fff",
  },
  errorText: {
    color: colors.danger,
    ...typography.caption,
    textAlign: "center",
  },
  warningText: {
    color: "#fcd34d",
    ...typography.caption,
    textAlign: "center",
  },
});
