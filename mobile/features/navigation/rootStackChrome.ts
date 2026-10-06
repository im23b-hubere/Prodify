import { colors } from "../../constants/theme";

/** Tab scenes and the app root must paint the same fill so a pop never flashes the system window. */
export const appRootFillStyle = {
  flex: 1,
  backgroundColor: colors.background,
} as const;

const SHELL_NO_SWIPE = {
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
} as const;

const HORIZONTAL_CARD_SWIPE = {
  animation: "slide_from_right" as const,
  gestureEnabled: true,
  gestureDirection: "horizontal" as const,
};

/**
 * Launch `/` stays under `(tabs)` after Redirect. On iOS 26 a fullscreen
 * swipe would pop that card once (black, then dashboard). Lock the shell;
 * keep swipe-back on pushed cards.
 */
export function rootStackScreenOptions(name: string): Record<string, unknown> {
  switch (name) {
    case "index":
    case "(tabs)":
      return { ...SHELL_NO_SWIPE };
    case "progression-overview":
      return { ...HORIZONTAL_CARD_SWIPE, animationTypeForReplace: "pop" };
    case "skill-tree":
      return {
        animation: "slide_from_right",
        animationTypeForReplace: "pop",
        ...SHELL_NO_SWIPE,
      };
    case "paywall":
    case "notifications":
    case "weekly-recap":
      return { animationTypeForReplace: "pop" };
    case "settings":
      return { ...HORIZONTAL_CARD_SWIPE };
    case "challenge/new":
      return {
        presentation: "modal",
        contentStyle: { backgroundColor: colors.background },
      };
    case "challenge/[id]":
      return { ...HORIZONTAL_CARD_SWIPE };
    case "session-active":
      return {
        presentation: "fullScreenModal",
        animation: "slide_from_bottom",
        gestureDirection: "vertical",
        gestureEnabled: true,
      };
    default:
      return {};
  }
}
