import { StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../../../constants/theme";

export function SessionSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRowShort} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonRow: {
    height: 16,
    borderRadius: 8,
    backgroundColor: "#242424",
  },
  skeletonRowShort: {
    height: 16,
    width: "60%",
    borderRadius: 8,
    backgroundColor: "#242424",
  },
});
