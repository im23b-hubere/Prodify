import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import type { WrappedSlide } from "./wrappedSlides";

export function useWrappedViewerNavigation(slides: WrappedSlide[], width: number) {
  const listRef = useRef<FlatList<WrappedSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next >= 0 && next < slides.length) setActiveIndex(next);
    },
    [slides.length, width],
  );
  const move = useCallback(
    (offset: -1 | 1) => {
      const next = activeIndex + offset;
      if (next < 0 || next >= slides.length) return;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
      Haptics.selectionAsync().catch(() => undefined);
    },
    [activeIndex, slides.length],
  );
  return {
    listRef,
    activeIndex,
    activeSlide: slides[activeIndex],
    onScroll,
    goNext: () => move(1),
    goPrev: () => move(-1),
  };
}
