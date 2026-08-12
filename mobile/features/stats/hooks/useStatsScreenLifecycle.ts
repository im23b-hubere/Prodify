import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, type LayoutChangeEvent, type ScrollView } from "react-native";

import { spacing } from "../../../constants/theme";

type LoadStats = (options?: { force?: boolean; forceProgressionSync?: boolean }) => Promise<void>;

type Params = {
  token: string | null;
  focusParam?: string;
  periodParam: string;
  showInitialLoading: boolean;
  loadStats: LoadStats;
  onFocusHandled: () => void;
};

export function useStatsScreenLifecycle({
  token,
  focusParam,
  periodParam,
  showInitialLoading,
  loadStats,
  onFocusHandled,
}: Params) {
  const scrollRef = useRef<ScrollView>(null);
  const yourWeekOffsetY = useRef(0);
  const pendingYourWeekFocus = useRef(false);
  const lastPeriod = useRef<string | null>(null);
  const contentFade = useRef(new Animated.Value(0)).current;

  const scrollToYourWeek = useCallback(() => {
    if (!pendingYourWeekFocus.current || yourWeekOffsetY.current <= 0) return;
    pendingYourWeekFocus.current = false;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, yourWeekOffsetY.current - spacing.md),
        animated: true,
      });
    });
    onFocusHandled();
  }, [onFocusHandled]);

  useFocusEffect(
    useCallback(() => {
      if (focusParam === "yourWeek") pendingYourWeekFocus.current = true;
      loadStats().catch(() => undefined);
    }, [focusParam, loadStats]),
  );

  useEffect(() => {
    if (lastPeriod.current === null) {
      lastPeriod.current = periodParam;
      return;
    }
    if (lastPeriod.current === periodParam) return;
    lastPeriod.current = periodParam;
    loadStats({ force: true }).catch(() => undefined);
  }, [loadStats, periodParam]);

  useEffect(() => {
    if (!pendingYourWeekFocus.current || showInitialLoading || !token) return;
    scrollToYourWeek();
  }, [scrollToYourWeek, showInitialLoading, token]);

  useEffect(() => {
    if (showInitialLoading) {
      contentFade.setValue(0);
      return;
    }
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentFade, showInitialLoading]);

  const handleYourWeekLayout = useCallback(
    (event: LayoutChangeEvent) => {
      yourWeekOffsetY.current = event.nativeEvent.layout.y;
      scrollToYourWeek();
    },
    [scrollToYourWeek],
  );

  return { scrollRef, contentFade, handleYourWeekLayout };
}
