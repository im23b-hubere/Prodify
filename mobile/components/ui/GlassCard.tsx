import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { colors, radii, spacing } from "../../constants/theme";

type GlassCardProps = {
  children: ReactNode;
};

export function GlassCard({ children }: GlassCardProps) {
  return (
    <LinearGradient colors={["rgba(255,61,0,0.45)", "rgba(162,89,255,0.25)"]} style={styles.gradientBorder}>
      <BlurView intensity={14} tint="dark" style={styles.inner}>
        <View style={styles.content}>{children}</View>
      </BlurView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBorder: {
    borderRadius: radii.xl,
    padding: 1,
  },
  inner: {
    borderRadius: radii.xl - 1,
    overflow: "hidden",
    backgroundColor: "rgba(20,20,20,0.8)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    padding: spacing.lg,
  },
});
