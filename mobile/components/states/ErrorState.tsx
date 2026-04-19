import { StyleSheet, Text, View } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { PrimaryButton } from "../ui/PrimaryButton";

type ErrorStateProps = {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({ title, message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && retryLabel ? <PrimaryButton label={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
    backgroundColor: "rgba(255,80,80,0.08)",
    padding: spacing.md,
    gap: spacing.xs,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  message: {
    color: "#ffb4b4",
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
});
