import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { Check, Crown, Lock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, type TextLayoutEvent, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii } from "../../../constants/theme";
import { progressionLevelName } from "../../../lib/progressionLevels";
import type { LevelTierTheme } from "../../../lib/progressionLevelTheme";
import { RankArt } from "../../../components/progression/RankArt";
import type { RankPathNode as RankPathNodeLayout } from "../rankPathLayout";

export type RankNodeState = "cleared" | "current" | "next" | "locked";

const NODE_SIZE: Record<RankNodeState, number> = {
  cleared: 58,
  current: 82,
  next: 64,
  locked: 54,
};
const SUMMIT_SIZE = 92;
const LABEL_GAP = 14;
const EDGE_PAD = 16;
/** Labels are vertically centred on their node inside a box this tall. */
const LABEL_BOX = 132;
const SUMMIT_TITLE_BOX = 120;

type Props = {
  node: RankPathNodeLayout;
  state: RankNodeState;
  summit: boolean;
  width: number;
  subtitle: string;
  /** Progress (0–1) toward the next rank, drawn as a small meter under the current rank. */
  meter?: number;
  t: TFunction;
};

export function RankPathNode({ node, state, summit, width, subtitle, meter, t }: Props) {
  const size = summit ? SUMMIT_SIZE : NODE_SIZE[state];
  const radius = size / 2;
  const name = progressionLevelName(t, node.level);
  const labelWidth =
    node.labelSide === "left"
      ? node.x - radius - LABEL_GAP - EDGE_PAD
      : width - node.x - radius - LABEL_GAP - EDGE_PAD;
  const labelPosition =
    node.labelSide === "left"
      ? { right: width - (node.x - radius - LABEL_GAP) }
      : { left: node.x + radius + LABEL_GAP };
  const statusLabel = t(`progression.path.status.${state}`);
  // A wrapped name claims the full label width, so the meter is sized to the widest line drawn.
  const [lineWidths, setLineWidths] = useState({ name: 0, subtitle: 0 });
  const measure = (key: "name" | "subtitle") =>
    meter == null
      ? undefined
      : (event: TextLayoutEvent) => {
          const widest = Math.ceil(
            Math.max(0, ...event.nativeEvent.lines.map((line) => line.width)),
          );
          setLineWidths((prev) => (prev[key] === widest ? prev : { ...prev, [key]: widest }));
        };
  const meterWidth = Math.max(lineWidths.name, lineWidths.subtitle);

  return (
    <>
      <View
        style={[
          styles.nodeWrap,
          { left: node.x - radius, top: node.y - radius, width: size, height: size },
        ]}
        accessible
        accessibilityLabel={t("progression.path.nodeA11y", {
          level: node.level,
          name,
          status: statusLabel,
          detail: subtitle,
        })}
      >
        {state === "current" ? <PulseRing tier={node.tier} size={size} /> : null}
        {/* A locked summit still shows its colours: the goal should glow from afar. */}
        <NodeEmblem
          tier={node.tier}
          level={node.level}
          state={summit && state === "locked" ? "next" : state}
          size={size}
        />
        {state === "cleared" ? (
          <View style={[styles.cornerBadge, { backgroundColor: node.tier.accent }]}>
            <Check color="#0a0a0a" size={11} strokeWidth={3.2} />
          </View>
        ) : null}
        {state === "next" || state === "locked" ? (
          <View style={[styles.cornerBadge, styles.lockBadge]}>
            <Lock
              color={state === "next" ? node.tier.accent : colors.textSecondary}
              size={10}
              strokeWidth={3}
            />
          </View>
        ) : null}
        {state === "current" ? (
          <View style={[styles.levelNotch, { backgroundColor: node.tier.accent }]}>
            <Text style={styles.levelNotchText}>
              {t("progression.xpHudLevelShort", { level: node.level })}
            </Text>
          </View>
        ) : null}
      </View>

      {state === "current" ? (
        <View style={[styles.hereMarker, { left: node.x - 60, top: node.y - radius - 34 }]}>
          <View style={[styles.herePill, { backgroundColor: node.tier.accent }]}>
            <Text style={styles.hereText}>{t("progression.path.youAreHere")}</Text>
          </View>
          <View style={[styles.hereCaret, { borderTopColor: node.tier.accent }]} />
        </View>
      ) : null}

      {summit ? (
        <SummitTitle
          tier={node.tier}
          name={name}
          subtitle={subtitle}
          reached={state === "current" || state === "cleared"}
          bottomY={node.y - radius - (state === "current" ? 46 : 16)}
          t={t}
        />
      ) : (
        <View
          style={[
            styles.label,
            labelPosition,
            { top: node.y - LABEL_BOX / 2, width: labelWidth },
            node.labelSide === "left" ? styles.labelLeft : styles.labelRight,
          ]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View>
            <Text
              style={[
                styles.name,
                state === "current" && styles.nameCurrent,
                state === "locked" && styles.nameLocked,
                node.labelSide === "left" && styles.textRight,
              ]}
              numberOfLines={2}
              onTextLayout={measure("name")}
            >
              {name}
            </Text>
            {meter != null ? (
              <View
                style={[
                  styles.meterTrack,
                  { width: meterWidth, opacity: meterWidth > 0 ? 1 : 0 },
                  node.labelSide === "left" ? styles.alignEnd : styles.alignStart,
                ]}
              >
                <View
                  style={[
                    styles.meterFill,
                    { width: `${Math.round(meter * 100)}%`, backgroundColor: node.tier.accent },
                  ]}
                />
              </View>
            ) : null}
            <Text
              style={[
                styles.subtitle,
                { color: state === "locked" ? colors.textSecondary : node.tier.accent },
                node.labelSide === "left" && styles.textRight,
              ]}
              numberOfLines={1}
              onTextLayout={measure("subtitle")}
            >
              {subtitle}
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

/** The final rank's billboard: ornament, big glowing name and what it takes to get there. */
function SummitTitle({
  tier,
  name,
  subtitle,
  reached,
  bottomY,
  t,
}: {
  tier: LevelTierTheme;
  name: string;
  subtitle: string;
  reached: boolean;
  bottomY: number;
  t: TFunction;
}) {
  return (
    <View
      style={[styles.summitTitle, { top: bottomY - SUMMIT_TITLE_BOX }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={styles.summitOrnament}>
        <LinearGradient
          colors={["rgba(0,0,0,0)", tier.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summitRule}
        />
        <Crown color={tier.accent} size={14} strokeWidth={2.4} />
        <Text style={[styles.summitKicker, { color: tier.accent }]}>
          {t("progression.path.finalRank")}
        </Text>
        <LinearGradient
          colors={[tier.accent, "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summitRule}
        />
      </View>
      <Text
        style={[styles.summitName, { color: tier.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {name}
      </Text>
      <Text style={[styles.summitSubtitle, reached && { color: tier.accent }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

function NodeEmblem({
  tier,
  level,
  state,
  size,
}: {
  tier: LevelTierTheme;
  level: number;
  state: RankNodeState;
  size: number;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      style={[
        styles.emblem,
        round,
        state === "current" && {
          borderColor: tier.accent,
          shadowColor: tier.glow,
          shadowOpacity: 1,
          shadowRadius: 18,
        },
      ]}
    >
      <RankArt level={level} size={size} />
      {/* Ranks ahead stay visible but dimmed: the next one clearly, the far ones as a tease. */}
      {state === "next" || state === "locked" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            round,
            state === "next" ? styles.nextDim : styles.lockedDim,
          ]}
        />
      ) : null}
    </View>
  );
}

/** Expanding ring behind the current rank, like a sonar ping. */
function PulseRing({ tier, size }: { tier: LevelTierTheme; size: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
    );
  }, [progress, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.35 : 0.7 * (1 - progress.value),
    transform: [{ scale: reduceMotion ? 1.18 : 1 + progress.value * 0.55 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        { width: size, height: size, borderRadius: size / 2, borderColor: tier.accent },
        ringStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  nodeWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  emblem: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
  },
  nextDim: {
    backgroundColor: "rgba(10,10,10,0.4)",
  },
  lockedDim: {
    backgroundColor: "rgba(10,10,10,0.68)",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 2,
  },
  cornerBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  lockBadge: {
    backgroundColor: colors.surface,
  },
  levelNotch: {
    position: "absolute",
    bottom: -8,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radii.round,
    borderWidth: 2,
    borderColor: colors.background,
  },
  levelNotchText: {
    color: "#0a0a0a",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 13,
  },
  hereMarker: {
    position: "absolute",
    width: 120,
    alignItems: "center",
  },
  herePill: {
    borderRadius: radii.round,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hereText: {
    color: "#0a0a0a",
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hereCaret: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  label: {
    position: "absolute",
    height: LABEL_BOX,
    justifyContent: "center",
    gap: 2,
  },
  meterTrack: {
    height: 6,
    marginVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: radii.round,
  },
  labelLeft: {
    alignItems: "flex-end",
  },
  labelRight: {
    alignItems: "flex-start",
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 19,
  },
  nameCurrent: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    lineHeight: 22,
  },
  nameLocked: {
    color: "rgba(255,255,255,0.5)",
  },
  subtitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  alignEnd: { alignSelf: "flex-end" },
  alignStart: { alignSelf: "flex-start" },
  summitTitle: {
    position: "absolute",
    left: EDGE_PAD,
    right: EDGE_PAD,
    height: SUMMIT_TITLE_BOX,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  summitOrnament: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  summitRule: {
    width: 28,
    height: 1,
  },
  summitKicker: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  summitName: {
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
  },
  summitSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  textRight: {
    textAlign: "right",
  },
});
