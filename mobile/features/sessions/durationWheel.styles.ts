import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, spacing, typography } from "../../constants/theme";
import { WHEEL_HEIGHT, WHEEL_ROW_HEIGHT, WHEEL_VISIBLE_ROWS } from "./durationWheel";

const HEADER_HEIGHT = 52;
const HEADER_BUTTON_SIZE = 44;
/** Digits sit right-aligned in this column so the unit beside them never moves. */
const DIGITS_WIDTH = 44;
const UNIT_WIDTH = 64;
const UNIT_GAP = 6;
const CENTRE_ROW_TOP = Math.floor(WHEEL_VISIBLE_ROWS / 2) * WHEEL_ROW_HEIGHT;

/** SwipeSheet's top padding and grabber, the header, the gap above the drums and the bottom padding. */
export const WHEEL_SHEET_HEIGHT = 8 + 29 + HEADER_HEIGHT + spacing.md + WHEEL_HEIGHT + spacing.xxl;

export const wheelStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: HEADER_HEIGHT,
    marginBottom: spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    paddingHorizontal: spacing.sm,
  },
  headerButton: {
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    borderRadius: HEADER_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  saveButton: { backgroundColor: colors.primary },
  drums: {
    flexDirection: "row",
    justifyContent: "center",
    height: WHEEL_HEIGHT,
  },
  selectionBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CENTRE_ROW_TOP,
    height: WHEEL_ROW_HEIGHT,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "rgba(118,118,128,0.24)",
  },
  drum: { flex: 1, maxWidth: 150, height: WHEEL_HEIGHT },
  drumContent: { paddingVertical: CENTRE_ROW_TOP },
  row: { height: WHEEL_ROW_HEIGHT },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    width: DIGITS_WIDTH,
    textAlign: "right",
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  valueDimmed: { color: colors.textSecondary },
  unitSpace: { width: UNIT_GAP + UNIT_WIDTH },
  unitRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: CENTRE_ROW_TOP,
    height: WHEEL_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  unitDigitsSpace: { width: DIGITS_WIDTH + UNIT_GAP },
  unit: {
    width: UNIT_WIDTH,
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
});
