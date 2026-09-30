import { StyleSheet } from "react-native";
import { type CSSAnimationProperties, cubicBezier } from "react-native-reanimated";

import { LIST_HAIRLINE, listStyles } from "../../../components/ui/list/listStyles";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";

const ACCENT_TINT = "rgba(255,61,0,0.12)";
export const LIVE_AVATAR_SIZE = 56;

/** Slow outward ripple behind a live friend's avatar; a loop, so it runs as a CSS animation. */
export const LIVE_PULSE_ANIMATION = {
  animationName: {
    from: { transform: [{ scale: 1 }], opacity: 0.7 },
    to: { transform: [{ scale: 1.3 }], opacity: 0 },
  },
  animationDuration: 1600,
  animationIterationCount: "infinite",
  animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const satisfies CSSAnimationProperties;

const activityStyles = StyleSheet.create({
  liveContent: { gap: spacing.md, paddingRight: spacing.md },
  liveFriend: { width: 64, alignItems: "center", gap: 6 },
  liveAvatar: {
    width: LIVE_AVATAR_SIZE,
    height: LIVE_AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  livePulse: {
    position: "absolute",
    width: LIVE_AVATAR_SIZE,
    height: LIVE_AVATAR_SIZE,
    borderRadius: LIVE_AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  liveName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 64,
  },
  liveType: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    maxWidth: 64,
  },

  days: { gap: spacing.md },
  day: { gap: spacing.xs },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
  },
  rowAside: { alignItems: "flex-end", gap: 6 },
  time: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 40,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: LIST_HAIRLINE,
    justifyContent: "center",
  },
  reactionActive: { backgroundColor: ACCENT_TINT, borderColor: "rgba(255,61,0,0.35)" },
  reactionCount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  reactionCountActive: { color: colors.primary },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LIST_HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  showMore: { alignSelf: "center" },
});

export const friendsActivityStyles = { ...listStyles, ...activityStyles };
