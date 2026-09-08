import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

async function playBreakCue(player: AudioPlayer): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
  });
  player.volume = 0.88;
  player.loop = false;
  await player.seekTo(0);
  player.play();
}

export function StreakBreakModal({ visible, brokenStreak, onStartFresh }: StreakBreakModalProps) {
  const { t } = useTranslation();
  const player = useAudioPlayer(SFX_SOURCE);
  const [lottieFailed, setLottieFailed] = useState(false);
  const [playbackToken, setPlaybackToken] = useState(0);

  useEffect(() => {
    if (!visible) {
      player.pause();
      return;
    }
    setLottieFailed(false);
    setPlaybackToken((token) => token + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    void playBreakCue(player).catch(() => undefined);
    return () => {
      player.pause();
    };
  }, [visible, player]);

  const handleClose = () => {
    player.pause();
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
          <Text style={styles.title}>{t("streakBreak.title", { days: brokenStreak })}</Text>
          <Text style={styles.sub}>{t("streakBreak.subtitle")}</Text>
          <View style={styles.achievement}>
            <Text style={styles.achievementTxt}>
              {t("streakBreak.achievement", { days: brokenStreak })}
            </Text>
          </View>
          <PrimaryButton label={t("streakBreak.startFresh")} onPress={handleClose} />
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
