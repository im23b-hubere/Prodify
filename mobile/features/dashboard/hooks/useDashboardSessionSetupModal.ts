import { Dimensions } from "react-native";
import { useCallback, useEffect, useState } from "react";
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function useDashboardSessionSetupModal() {
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupModalKey, setSetupModalKey] = useState(0);
  const sheetTranslateY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (!setupVisible) return;
    sheetTranslateY.value = SCREEN_HEIGHT;
    sheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 260 });
  }, [setupVisible, sheetTranslateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const closeSetupModal = useCallback(
    (after?: () => void) => {
      sheetTranslateY.value = withTiming(SCREEN_HEIGHT * 1.08, { duration: 320 }, (finished) => {
        if (finished) {
          runOnJS(() => {
            setSetupVisible(false);
            after?.();
          })();
        }
      });
    },
    [sheetTranslateY],
  );

  const presentSessionSetupModalFresh = useCallback(() => {
    sheetTranslateY.value = SCREEN_HEIGHT;
    setSetupModalKey((k) => k + 1);
    setSetupVisible(true);
  }, [sheetTranslateY]);

  return {
    setupVisible,
    setupModalKey,
    sheetStyle,
    closeSetupModal,
    presentSessionSetupModalFresh,
  };
}
