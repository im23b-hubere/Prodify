import type { ViewStyle } from "react-native";

import { motion } from "../../constants/theme";

type PressTone = "light" | "default" | "strong";

export function pressFeedbackStyle(
  pressed: boolean,
  tone: PressTone = "default",
): ViewStyle | null {
  if (!pressed) return null;
  if (tone === "light") {
    return { opacity: motion.pressOpacityLight, transform: [{ scale: motion.pressScale }] };
  }
  if (tone === "strong") {
    return { opacity: motion.pressOpacity, transform: [{ scale: motion.pressScaleStrong }] };
  }
  return { opacity: motion.pressOpacity, transform: [{ scale: motion.pressScale }] };
}
