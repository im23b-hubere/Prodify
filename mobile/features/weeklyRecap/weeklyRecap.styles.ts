import { StyleSheet } from "react-native";

import { colors, spacing } from "../../constants/theme";

export const weeklyRecapStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fullscreen: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  stateWrap: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: "center" },
  hiddenShot: { position: "absolute", left: -5000, top: 0, width: 360, height: 640 },
  shotInner: { width: 360, height: 640 },
});
