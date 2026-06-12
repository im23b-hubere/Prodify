import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type Props = {
  title: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
  testID?: string;
};

export const PremiumFeatureTeaser = memo(function PremiumFeatureTeaser({
  title,
  body,
  ctaLabel,
  onPress,
  testID,
}: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <PrimaryButton label={ctaLabel} onPress={onPress} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    backgroundColor: "rgba(251,191,36,0.08)",
  },
  title: {
    color: "#fcd34d",
    fontFamily: fontFamily.heading,
    ...typography.body,
  },
  body: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
});
