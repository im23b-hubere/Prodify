import { memo } from "react";
import { FlatList, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WeeklyShareTemplateId } from "./WeeklyWrappedShareCard";
import { WrappedBottomBar, WrappedTopBar } from "./WeeklyWrappedControls";
import { styles } from "./WeeklyWrappedViewer.styles";
import { WrappedSlideCard } from "./WrappedSlideCard";
import type { WrappedSlide } from "./wrappedSlides";
import { useWrappedViewerNavigation } from "./useWrappedViewerNavigation";

export type WeeklyWrappedViewerProps = {
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

export const WeeklyWrappedViewer = memo(function WeeklyWrappedViewer(
  props: WeeklyWrappedViewerProps,
) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useWrappedViewerNavigation(props.slides, width);
  const controlProps = {
    ...props,
    activeIndex: navigation.activeIndex,
    topInset: insets.top,
    bottomInset: insets.bottom,
  };
  return (
    <View style={styles.root} testID="weekly-wrapped-viewer">
      <WrappedTopBar {...controlProps} />
      <FlatList
        ref={navigation.listRef}
        data={props.slides}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={navigation.onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <WrappedSlideCard
            slide={item}
            width={width}
            height={Math.max(420, height - insets.top - insets.bottom)}
          />
        )}
      />
      <Pressable style={[styles.tapPrev, { top: insets.top + 56 }]} onPress={navigation.goPrev} />
      <Pressable style={[styles.tapNext, { top: insets.top + 56 }]} onPress={navigation.goNext} />
      <WrappedBottomBar {...controlProps} />
    </View>
  );
});
