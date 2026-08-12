import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { memo, useCallback, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { TextButton } from "../../components/ui/TextButton";
import { colors, spacing } from "../../constants/theme";
import type { WrappedSlide } from "./wrappedSlides";
import { WrappedSlideCard } from "./WrappedSlideCard";
import { styles } from "./WeeklyWrappedViewer.styles";
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
                style={[
                  styles.progressSegment,
                  index <= activeIndex && styles.progressSegmentActive,
                ]}
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
