import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { returnTo } from "../../../lib/stackNavigation";
import { useActiveSession } from "./useActiveSession";

export function useActiveSessionController() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; source?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useActiveSession(id);
  const pulse = useSharedValue(1);

  // The LIVE dot breathes while the clock runs and holds still when paused.
  useEffect(() => {
    pulse.value = state.isPaused
      ? withTiming(1, { duration: 200 })
      : withRepeat(
          withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })),
          -1,
        );
  }, [pulse, state.isPaused]);

  return {
    id,
    ...state,
    pulseStyle: useAnimatedStyle(() => ({ opacity: pulse.value })),
    openDashboard: () => returnTo(router, "/(tabs)/dashboard", { modal: true }),
  };
}

export type ActiveSessionController = ReturnType<typeof useActiveSessionController>;
