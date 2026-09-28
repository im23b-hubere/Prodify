import { LinearGradient } from "expo-linear-gradient";
import type { TFunction } from "i18next";
import { Lock } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing } from "../../../constants/theme";
import type { ProgressionLevelItem } from "../../../lib/progressionLevelCatalog";
import type { LevelTierTheme } from "../../../lib/progressionLevelTheme";
import { pointAlongSegment, type RankPathLayout, type RankPathSegment } from "../rankPathLayout";
import { type RankNodeState, RankPathNode } from "./RankPathNode";
import { RankPathScenery } from "./RankPathScenery";

type Props = {
  layout: RankPathLayout;
  currentLevel: number;
  progressPercent: number;
  xpTotal: number;
  xpToNext: number;
  levelCatalog: ProgressionLevelItem[];
  t: TFunction;
};

function nodeState(level: number, currentLevel: number): RankNodeState {
  if (level < currentLevel) return "cleared";
  if (level === currentLevel) return "current";
  if (level === currentLevel + 1) return "next";
  return "locked";
}

/** The rank screen's trail: tier zones as the backdrop, the climbed part of the path lit up. */
export function RankPath({
  layout,
  currentLevel,
  progressPercent,
  xpTotal,
  xpToNext,
  levelCatalog,
  t,
}: Props) {
  const maxLevel = layout.nodes.length;
  const xpStartByLevel = useMemo(
    () => new Map(levelCatalog.map((entry) => [entry.level, entry.xp_start])),
    [levelCatalog],
  );

  const subtitleFor = (level: number, state: RankNodeState) => {
    switch (state) {
      case "cleared":
        return t("progression.path.clearedLine", { level });
      case "current":
        return level >= maxLevel
          ? t("progression.path.maxLine", { xp: xpTotal.toLocaleString() })
          : t("progression.path.currentLine", {
              xp: xpTotal.toLocaleString(),
              target: (xpTotal + xpToNext).toLocaleString(),
              toGo: xpToNext.toLocaleString(),
            });
      case "next":
        return t("progression.path.nextLine", { level });
      default: {
        const xpStart = xpStartByLevel.get(level);
        return xpStart == null
          ? t("progression.xpHudLevelShort", { level })
          : t("progression.path.lockedLine", { level, xp: xpStart.toLocaleString() });
      }
    }
  };

  return (
    <View style={{ width: layout.width, height: layout.height }} testID="rank-path">
      <RankPathScenery layout={layout} />
      <RankPathTrail
        layout={layout}
        currentLevel={currentLevel}
        progressPercent={progressPercent}
      />

      {layout.gates.map((gate) => (
        <TierGate
          key={gate.tier.id}
          tier={gate.tier}
          y={gate.y}
          reached={currentLevel >= gate.fromLevel}
          label={t("progression.path.tierRange", {
            tier: t(gate.tier.labelKey),
            from: gate.fromLevel,
            to: gate.toLevel,
          })}
        />
      ))}

      {layout.nodes.map((node) => {
        const state = nodeState(node.level, currentLevel);
        return (
          <RankPathNode
            key={node.level}
            node={node}
            state={state}
            summit={node.level === maxLevel}
            width={layout.width}
            subtitle={subtitleFor(node.level, state)}
            meter={
              state === "current" && node.level < maxLevel
                ? Math.max(0, Math.min(1, progressPercent / 100))
                : undefined
            }
            t={t}
          />
        );
      })}

      <StartArea y={(layout.nodes[0]?.y ?? 0) + 58} t={t} />
    </View>
  );
}

function RankPathTrail({
  layout,
  currentLevel,
  progressPercent,
}: {
  layout: RankPathLayout;
  currentLevel: number;
  progressPercent: number;
}) {
  const progress = Math.max(0, Math.min(1, progressPercent / 100));
  const activeSegment = layout.segments.find((segment) => segment.fromLevel === currentLevel);
  // Glowing head at the end of the lit trail: where the user is between two ranks.
  const tip =
    activeSegment && progress > 0.01
      ? { ...pointAlongSegment(activeSegment, progress), color: activeSegment.tier.accent }
      : null;
  return (
    <Svg
      width={layout.width}
      height={layout.height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Path
        d={layout.fullPath}
        stroke="#ffffff"
        strokeOpacity={0.05}
        strokeWidth={20}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={layout.fullPath}
        stroke="#ffffff"
        strokeOpacity={0.24}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray="0.1 12"
        fill="none"
      />
      {layout.segments.map((segment) => {
        if (segment.fromLevel < currentLevel)
          return <LitSegment key={segment.fromLevel} segment={segment} />;
        if (segment.fromLevel === currentLevel && progress > 0.01) {
          return <LitSegment key={segment.fromLevel} segment={segment} fraction={progress} />;
        }
        return null;
      })}
      {tip ? (
        <>
          <Circle cx={tip.x} cy={tip.y} r={11} fill={tip.color} opacity={0.3} />
          <Circle cx={tip.x} cy={tip.y} r={5} fill="#ffffff" />
        </>
      ) : null}
    </Svg>
  );
}

function LitSegment({ segment, fraction = 1 }: { segment: RankPathSegment; fraction?: number }) {
  const dash = fraction < 1 ? `${segment.length * fraction} ${segment.length * 2}` : undefined;
  const common = {
    d: segment.d,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeDasharray: dash,
  };
  return (
    <>
      <Path {...common} stroke={segment.tier.accent} strokeOpacity={0.22} strokeWidth={18} />
      <Path {...common} stroke={segment.tier.accent} strokeWidth={6} />
      <Path {...common} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={1.5} />
    </>
  );
}

function TierGate({
  tier,
  y,
  reached,
  label,
}: {
  tier: LevelTierTheme;
  y: number;
  reached: boolean;
  label: string;
}) {
  return (
    <View style={[styles.gate, { top: y - 15 }]} pointerEvents="none">
      <LinearGradient
        colors={[
          "rgba(0,0,0,0)",
          reached ? tier.accent : "rgba(255,255,255,0.18)",
          "rgba(0,0,0,0)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gateLine}
      />
      <View style={[styles.gatePill, { borderColor: reached ? tier.accent : colors.border }]}>
        {reached ? (
          <View style={[styles.gateDot, { backgroundColor: tier.accent }]} />
        ) : (
          <Lock color={colors.textSecondary} size={11} strokeWidth={2.6} />
        )}
        <Text style={[styles.gateText, { color: reached ? tier.accent : colors.textSecondary }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Starting line under level 1: the word flanked by rules that fade out to the edges. */
function StartArea({ y, t }: { y: number; t: TFunction }) {
  return (
    <View style={[styles.start, { top: y }]}>
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.45)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.startRule}
      />
      <Text style={styles.startLabel}>{t("progression.path.start")}</Text>
      <LinearGradient
        colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.startRule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  gateLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 14.5,
    height: 1,
  },
  gatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.round,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  gateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  gateText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  start: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  startRule: {
    flex: 1,
    height: 1,
  },
  startLabel: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
