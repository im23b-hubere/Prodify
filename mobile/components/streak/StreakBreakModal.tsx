import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Flame } from "lucide-react-native";

import { PrimaryButton } from "../ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";

/** Lottie: community pack lf20_tl52xzvn (LottieFiles) — replace for production if license requires. */
const LOTTIE_SOURCE = require("../../assets/lottie/streak-break-flame.json");
const SFX_SOURCE = require("../../assets/sounds/streak-break-sad.wav");

type StreakBreakModalProps = {
  visible: boolean;
  brokenStreak: number;
  onStartFresh: () => void;
};

export function StreakBreakModal({ visible, brokenStreak, onStartFresh }: StreakBreakModalProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [lottieFailed, setLottieFailed] = useState(false);
  const [playbackToken, setPlaybackToken] = useState(0);

  const playBreakSound = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(SFX_SOURCE, {
        shouldPlay: true,
        volume: 0.88,
        isLooping: false,
      });
      soundRef.current = sound;
    } catch {
      /* ignore — still show modal */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setLottieFailed(false);
    setPlaybackToken((t) => t + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    playBreakSound();
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, [visible, playBreakSound]);

  const handleClose = () => {
    soundRef.current?.stopAsync().catch(() => undefined);
    onStartFresh();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <LinearGradient colors={["#1a0a0a", "#0a0a0a"]} style={styles.card}>
          <View style={styles.animWrap}>
            {!lottieFailed ? (
              <LottieView
                key={playbackToken}
                source={LOTTIE_SOURCE}
                autoPlay
                loop={false}
                style={styles.lottie}
                onAnimationFailure={() => setLottieFailed(true)}
              />
            ) : (
              <View style={styles.fallbackFlame}>
                <Flame color={colors.primary} size={88} />
              </View>
            )}
          </View>
          <Text style={styles.title}>Your {brokenStreak}-day streak ended</Text>
          <Text style={styles.sub}>Every producer has setbacks. Start again today.</Text>
          <View style={styles.achievement}>
            <Text style={styles.achievementTxt}>
              You still achieved {brokenStreak} days. That counts.
            </Text>
          </View>
          <PrimaryButton label="Start fresh" onPress={handleClose} />
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
  animWrap: {
    width: 200,
    height: 200,
    marginBottom: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: 200,
    height: 200,
  },
  fallbackFlame: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
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
