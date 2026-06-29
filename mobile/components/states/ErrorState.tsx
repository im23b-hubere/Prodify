import { AlertCircle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

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
      <View style={styles.iconWrap}>
        <AlertCircle color={colors.danger} size={22} />
      </View>
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
    alignItems: "center",
    gap: ui.compactGap,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,80,80,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.cardTitle,
    textAlign: "center",
  },
  message: {
    color: colors.danger,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
});
