import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { fontFamily } from "../../constants/fonts";
import { colors } from "../../constants/theme";
import { useRankProgression } from "../../hooks/useRankProgression";
import { levelTierFor } from "../../lib/progressionLevelTheme";
import {
  type ProgressionOverviewFrom,
  progressionOverviewHref,
} from "../../lib/progressionNavigation";
import { RankArt } from "./RankArt";

const RING_SIZE = 40;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const EMBLEM_SIZE = RING_SIZE - RING_STROKE * 2 - 4;

type Props = {
  from: ProgressionOverviewFrom;
  enabled?: boolean;
};

/**
 * Game-style rank badge: tier-colored emblem wrapped in an XP progress ring, with the level
 * number notched underneath. The rank name lives on the progression screen, not in the header.
 */
export function RankHudChip({ from, enabled = true }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { ready, level, progressPercent, rankName } = useRankProgression(enabled);

  if (!ready || level == null) return null;

  const tier = levelTierFor(level);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progressPercent / 100);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("progression.xpHudA11y", { name: rankName })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPercent) }}
      hitSlop={6}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        router.push(progressionOverviewHref(from));
      }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={colors.border}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={tier.accent}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          fill="none"
        />
      </Svg>

      <View style={[styles.emblem, { shadowColor: tier.glow }]}>
        <RankArt level={level} size={EMBLEM_SIZE} />
      </View>

      <View style={[styles.levelNotch, { backgroundColor: tier.accent }]}>
        <Text style={styles.levelNotchText}>{level}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  ring: {
    position: "absolute",
    // Start the progress arc at 12 o'clock.
    transform: [{ rotate: "-90deg" }],
  },
  emblem: {
    width: EMBLEM_SIZE,
    height: EMBLEM_SIZE,
    borderRadius: EMBLEM_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  levelNotch: {
    position: "absolute",
    bottom: -5,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    // Matches the screen background so the notch reads as cut out of the ring.
    borderColor: colors.background,
    alignItems: "center",
  },
  levelNotchText: {
    color: "#0a0a0a",
    fontFamily: fontFamily.bodyBold,
    fontSize: 9,
    lineHeight: 11,
  },
});
