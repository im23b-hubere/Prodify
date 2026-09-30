import { StyleSheet } from "react-native";

import { listStyles } from "../../../components/ui/list/listStyles";
import { colors, radii, spacing } from "../../../constants/theme";

const BONE = "rgba(255,255,255,0.08)";

const skeletonStyles = StyleSheet.create({
  skeleton: { gap: spacing.xl },
  hero: { height: 232, borderRadius: radii.xl, backgroundColor: colors.surface },
  heading: { width: 120, height: 20, borderRadius: radii.sm, backgroundColor: colors.surface },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: BONE },
  lines: { flex: 1, gap: 8 },
  lineWide: { width: "60%", height: 12, borderRadius: 6, backgroundColor: BONE },
  lineNarrow: { width: "35%", height: 10, borderRadius: 5, backgroundColor: BONE },
});

export const friendsSkeletonStyles = { ...listStyles, ...skeletonStyles };
