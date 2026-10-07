import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

export const WHEEL_ITEM_HEIGHT = 36;
export const WHEEL_VISIBLE_ROWS = 5;
export const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;

export const wheelStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheet: {
    height: "50%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: { width: 88, minHeight: 44, justifyContent: "center" },
  headerSideEnd: { alignItems: "flex-end" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  headerAction: {
    color: colors.primary,
    fontFamily: fontFamily.body,
    ...typography.body,
    paddingHorizontal: spacing.sm,
  },
  headerActionSave: { fontFamily: fontFamily.bodyBold },
  stage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  drums: {
    flexDirection: "row",
    justifyContent: "center",
    height: WHEEL_HEIGHT,
    overflow: "hidden",
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  drum: { flex: 1, maxWidth: 160 },
  drumItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  drumValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: 22,
    lineHeight: 28,
  },
  selection: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_ITEM_HEIGHT * 2,
    height: WHEEL_ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: spacing.md,
    pointerEvents: "none",
  },
  unit: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT * 2,
    pointerEvents: "none",
  },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
