import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressSegmentActive: {
    backgroundColor: "#fff",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  slide: {
    justifyContent: "center",
  },
  slideInner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 88,
    paddingBottom: 160,
    gap: spacing.sm,
  },
  kicker: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#fff",
    fontFamily: fontFamily.heading,
  },
  titleIntro: {
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
  },
  titleStat: {
    fontSize: 92,
    lineHeight: 96,
    letterSpacing: -2.5,
  },
  titleLabel: {
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -0.8,
    maxWidth: "100%",
  },
  titleQuote: {
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  titleOutro: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  titleEmpty: {
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
    maxWidth: 320,
  },
  subtitleStat: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 18,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  footnote: {
    marginTop: spacing.sm,
    color: "rgba(255,255,255,0.62)",
    fontFamily: fontFamily.body,
    ...typography.caption,
    maxWidth: 320,
    lineHeight: 20,
  },
  tapPrev: {
    position: "absolute",
    left: 0,
    top: 88,
    bottom: 160,
    width: "34%",
    zIndex: 5,
  },
  tapNext: {
    position: "absolute",
    right: 0,
    top: 88,
    bottom: 160,
    width: "66%",
    zIndex: 5,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    zIndex: 8,
  },
  swipeHint: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  actionBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  templateRow: {
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
  },
  templateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  templateChipActive: {
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  templateChipText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  templateChipTextActive: {
    color: "#fff",
  },
  errorText: {
    color: colors.danger,
    ...typography.caption,
    textAlign: "center",
  },
  warningText: {
    color: "#fcd34d",
    ...typography.caption,
    textAlign: "center",
  },
});
