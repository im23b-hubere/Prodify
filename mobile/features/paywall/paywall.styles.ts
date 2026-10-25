import { StyleSheet } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors } from "../../constants/theme";

/** One rhythm for the whole page, so header, list and plans read as a single piece. */
const SECTION_GAP = 34;
const SIDE = 24;

export const paywallStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // A soft orange light from the top that the header, list and plans all sit in.
  glow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 420,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SIDE,
    paddingTop: 20,
    paddingBottom: 16,
  },
  eyebrow: {
    marginBottom: 10,
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  titleAccent: {
    color: colors.primary,
  },
  benefits: {
    marginTop: SECTION_GAP,
    gap: 20,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  // Just the icon, centred in a fixed slot so every line of text starts at the same edge.
  benefitIcon: {
    width: 26,
    alignItems: "center",
  },
  benefitText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 17,
    lineHeight: 23,
  },
  plans: {
    marginTop: SECTION_GAP + 6,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  tileWrap: {
    flex: 1,
  },
  tile: {
    flex: 1,
    padding: 16,
    gap: 4,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#262626",
    backgroundColor: colors.surface,
  },
  tileSelected: {
    borderColor: colors.primary,
    backgroundColor: "#170d09",
  },
  tilePressed: {
    transform: [{ scale: 0.98 }],
  },
  tileDisabled: {
    opacity: 0.5,
  },
  // Sits on the tile's top edge instead of inside it, so neither tile needs extra room.
  badgeAnchor: {
    position: "absolute",
    top: -11,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#3a1a0e",
  },
  badgeSelected: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tileTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
  },
  tileTitleSelected: {
    color: colors.textPrimary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textPrimary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceAmount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  priceUnit: {
    marginLeft: 2,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
  },
  billing: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
  reassurance: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  reassuranceText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
  dock: {
    paddingHorizontal: SIDE,
    paddingTop: 8,
    paddingBottom: 4,
  },
  unlockGlow: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 8,
    bottom: 0,
    borderRadius: 30,
    backgroundColor: colors.primary,
  },
  unlock: {
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
  },
  unlockFill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  unlockPressed: {
    transform: [{ scale: 0.97 }],
  },
  unlockDisabled: {
    opacity: 0.5,
  },
  unlockText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
  },
  disclaimer: {
    marginTop: 10,
    color: "#6f6f6f",
    fontFamily: fontFamily.body,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  link: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  linkText: {
    color: "#8a8a8a",
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
  linkDot: {
    color: "#4a4a4a",
    fontSize: 12,
  },
  deleteAccount: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteAccountText: {
    color: "#5f5f5f",
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  skipDev: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipDevText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    opacity: 0.7,
  },
});
