import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Onboarding's one button: full width, Prodify orange with an arrow pointing on. Until an
 * answer is picked it sits flat and grey.
 */
export function OnboardingButton({ label, onPress, disabled = false, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.idle, pressed && styles.pressed]}
    >
      {disabled ? null : (
        <LinearGradient
          colors={[colors.primary, "#ff6a2b"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.label, disabled && styles.labelIdle]} numberOfLines={1}>
        {label}
      </Text>
      {disabled ? null : <ArrowRight size={19} color={colors.textPrimary} strokeWidth={2.4} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  idle: {
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#262626",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  label: {
    marginRight: 10,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 17,
  },
  labelIdle: {
    marginRight: 0,
    color: "#5f5f5f",
  },
});
