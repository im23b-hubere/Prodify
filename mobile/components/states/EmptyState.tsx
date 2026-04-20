import { StyleSheet, Text } from "react-native";

import { fontFamily } from "../../constants/fonts";
import { colors, typography, ui } from "../../constants/theme";
import { AppCard } from "../ui/AppCard";
import { PrimaryButton } from "../ui/PrimaryButton";

type EmptyStateProps = {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = "•", title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <AppCard style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: ui.compactGap,
  },
  icon: {
    fontSize: 26,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
    textAlign: "center",
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
});
