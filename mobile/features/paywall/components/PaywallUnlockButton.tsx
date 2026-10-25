import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../../constants/theme";
import { paywallStyles as styles } from "../paywall.styles";

type Props = {
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
};

/** The buy button. A soft orange glow breathes underneath it while it waits for a tap. */
export function PaywallUnlockButton({ label, busy, disabled, onPress }: Props) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.set(
      withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0 : 0.18 + breath.get() * 0.22,
    transform: [{ scaleX: 0.96 + breath.get() * 0.04 }],
  }));

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.unlockGlow, glowStyle]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.unlock,
          pressed && styles.unlockPressed,
          disabled && !busy && styles.unlockDisabled,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, "#ff6a2b"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.unlockFill}
        >
          {busy ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <Text style={styles.unlockText}>{label}</Text>
              <ArrowRight size={19} color={colors.textPrimary} strokeWidth={2.4} />
            </>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}
