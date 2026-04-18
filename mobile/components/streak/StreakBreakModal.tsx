import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Flame } from "lucide-react-native";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

type StreakBreakModalProps = {
  visible: boolean;
  brokenStreak: number;
  onStartFresh: () => void;
};

export function StreakBreakModal({ visible, brokenStreak, onStartFresh }: StreakBreakModalProps) {
  const flameOpacity = useSharedValue(1);
  const flameScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    flameOpacity.value = 1;
    flameScale.value = 1;
    flameOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0.15, { duration: 2200, easing: Easing.out(Easing.cubic) })
    );
    flameScale.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0.85, { duration: 2200, easing: Easing.out(Easing.cubic) })
    );
  }, [visible, flameOpacity, flameScale]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: flameOpacity.value,
    transform: [{ scale: flameScale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStartFresh}>
      <View style={styles.backdrop}>
        <LinearGradient colors={["#1a0a0a", "#0a0a0a"]} style={styles.card}>
          <Animated.View style={[styles.flameWrap, flameStyle]}>
            <Flame color={colors.primary} size={72} />
          </Animated.View>
          <Text style={styles.title}>Your {brokenStreak}-day streak ended</Text>
          <Text style={styles.sub}>Every producer has setbacks. Start again today.</Text>
          <View style={styles.achievement}>
            <Text style={styles.achievementTxt}>You still achieved {brokenStreak} days. That counts.</Text>
          </View>
          <PrimaryButton label="Start fresh" onPress={onStartFresh} />
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  flameWrap: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 24,
    textAlign: "center",
  },
  sub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  achievement: {
    backgroundColor: "rgba(0,255,136,0.08)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.25)",
    padding: spacing.md,
    width: "100%",
  },
  achievementTxt: {
    color: colors.success,
    ...typography.caption,
    textAlign: "center",
    fontFamily: fontFamily.bodyMedium,
  },
});
