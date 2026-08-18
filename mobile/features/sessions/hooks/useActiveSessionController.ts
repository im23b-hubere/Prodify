import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useActiveSession } from "./useActiveSession";

export function useActiveSessionController() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; source?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const source = Array.isArray(params.source) ? params.source[0] : params.source;
  const state = useActiveSession(id);
  const pulse = useSharedValue(1);
  const dismissDragY = useSharedValue(0);

  useEffect(() => {
    pulse.value = state.isPaused
      ? withTiming(1, { duration: 200 })
      : withRepeat(
          withSequence(withTiming(1.04, { duration: 500 }), withTiming(1, { duration: 500 })),
          -1,
        );
  }, [pulse, state.isPaused]);

  const minimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (router.canDismiss()) return router.dismiss();
    if (router.canGoBack()) return router.back();
    router.replace("/(tabs)/dashboard");
  }, [router]);
  const finishDrag = useCallback(
    (translationY: number, velocityY: number) => {
      if (translationY > 48 || velocityY > 650) return minimize();
      dismissDragY.value = withTiming(0, { duration: 220 });
    },
    [dismissDragY, minimize],
  );
  const swipeDownGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(source === "dashboard")
        .activeOffsetY(12)
        .failOffsetX([-28, 28])
        .onUpdate((event) => {
          dismissDragY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => runOnJS(finishDrag)(event.translationY, event.velocityY)),
    [dismissDragY, finishDrag, source],
  );

  return {
    id,
    ...state,
    fromDashboard: source === "dashboard",
    pulseStyle: useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] })),
    dismissDragStyle: useAnimatedStyle(() => ({ transform: [{ translateY: dismissDragY.value }] })),
    swipeDownGesture,
    openDashboard: () => router.replace("/(tabs)/dashboard"),
  };
}

export type ActiveSessionController = ReturnType<typeof useActiveSessionController>;
