import { Lock, type LucideIcon } from "lucide-react-native";
import { memo, useEffect, type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import {
  LOCKED_ICON_COLOR,
  LOCKED_NODE_BORDER,
  LOCKED_NODE_FILL,
  styles,
} from "../skillTree.styles";

const RING_GAP = 5;
const RING_WIDTH = 3;
const PULSE_REPEATS = 3;
/** Focus labels appear once the tree is zoomed in far enough to read them. */
const LABEL_FADE_SCALES = [0.55, 0.8];
const ENTER_DELAY_BY_KIND = { center: 0, branch: 140, focus: 300 } as const;

type SkillTreeNodeProps = {
  id: string;
  kind: "center" | "branch" | "focus";
  x: number;
  y: number;
  size: number;
  accent: string;
  Icon?: LucideIcon;
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  isUnlocked: boolean;
  level: number;
  levelFraction: number;
  isSelected: boolean;
  isNew: boolean;
  scale: SharedValue<number>;
  onPress: (id: string) => void;
  children?: ReactNode;
};

export const SkillTreeNode = memo(function SkillTreeNode({
  id,
  kind,
  x,
  y,
  size,
  accent,
  Icon,
  label,
  accessibilityLabel,
  accessibilityHint,
  isUnlocked,
  level,
  levelFraction,
  isSelected,
  isNew,
  scale,
  onPress,
  children,
}: SkillTreeNodeProps) {
  const selectedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isSelected ? 1.12 : 1, { duration: 180 }) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity:
      kind === "focus"
        ? interpolate(scale.get(), LABEL_FADE_SCALES, [0, 1], Extrapolation.CLAMP)
        : 1,
  }));

  return (
    <Animated.View
      entering={ZoomIn.delay(ENTER_DELAY_BY_KIND[kind]).duration(360)}
      style={[styles.node, { left: x - size / 2, top: y - size / 2, width: size }]}
    >
      {isNew ? <UnlockPulse size={size} accent={accent} /> : null}
      {isUnlocked && kind !== "center" ? (
        <ProgressRing size={size} accent={accent} fraction={levelFraction} />
      ) : null}
      <Animated.View style={selectedStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ selected: isSelected }}
          onPress={() => onPress(id)}
          testID={`skill-tree-node-${id}`}
          style={[
            styles.nodeCircle,
            {
              width: size,
              height: size,
              backgroundColor: isUnlocked ? `${accent}24` : LOCKED_NODE_FILL,
              borderColor: isSelected ? "#ffffff" : isUnlocked ? accent : LOCKED_NODE_BORDER,
              boxShadow: isUnlocked ? `0 0 ${size / 2}px ${accent}55` : undefined,
            },
          ]}
        >
          {children ??
            (isUnlocked && Icon ? (
              <Icon size={size * 0.42} color={accent} strokeWidth={2} />
            ) : (
              <Lock size={size * 0.34} color={LOCKED_ICON_COLOR} strokeWidth={2} />
            ))}
        </Pressable>
        {isUnlocked && kind !== "center" ? (
          <Animated.View style={[styles.levelBadge, { backgroundColor: accent }]}>
            <Text style={styles.levelBadgeText}>{level}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>
      {kind === "center" ? null : (
        <Animated.Text
          numberOfLines={2}
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[
            styles.nodeLabel,
            kind === "branch" && styles.branchLabel,
            { top: size + 8, left: (size - 100) / 2, color: isUnlocked ? "#ffffff" : "#5c5c5c" },
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
      )}
    </Animated.View>
  );
});

function ProgressRing({ size, accent, fraction }: { size: number; accent: string; fraction: number }) {
  const ringSize = size + RING_GAP * 2 + RING_WIDTH;
  const radius = (ringSize - RING_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = -(RING_GAP + RING_WIDTH / 2);
  return (
    <Svg
      width={ringSize}
      height={ringSize}
      style={[styles.nodeRing, { left: offset, top: offset }]}
      pointerEvents="none"
    >
      <Circle
        cx={ringSize / 2}
        cy={ringSize / 2}
        r={radius}
        stroke={`${accent}2e`}
        strokeWidth={RING_WIDTH}
        fill="none"
      />
      <Circle
        cx={ringSize / 2}
        cy={ringSize / 2}
        r={radius}
        stroke={accent}
        strokeWidth={RING_WIDTH}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - Math.max(0.03, fraction))}
        transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
      />
    </Svg>
  );
}

function UnlockPulse({ size, accent }: { size: number; accent: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(
      withDelay(
        700,
        withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), PULSE_REPEATS),
      ),
    );
  }, [progress, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0.7, 0]),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [1, 1.9]) }],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.nodePulse, { width: size, height: size, borderColor: accent }, pulseStyle]}
    />
  );
}
