import { StyleSheet, Text } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, typography, ui } from "../../constants/theme";
import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";

type ErrorStateProps = {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({ title, message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <AppCard style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && retryLabel ? <PrimaryButton label={retryLabel} onPress={onRetry} /> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: "rgba(255,80,80,0.35)",
    backgroundColor: "rgba(255,80,80,0.08)",
    gap: ui.compactGap,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
  },
  message: {
    color: "#ffb4b4",
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
});
