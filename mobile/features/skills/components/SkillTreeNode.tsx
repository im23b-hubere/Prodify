import { Lock, type LucideIcon } from "lucide-react-native";
import { memo, useEffect, type ReactNode } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import {
  LOCKED_ICON_COLOR,
  LOCKED_NODE_BORDER,
  LOCKED_NODE_FILL,
  styles,
} from "../skillTree.styles";

const LEVEL_COUNT = 7;
const SEGMENT_GAP_DEGREES = 9;
const RING_GAP = 5;
const RING_WIDTH = 3;
const LABEL_WIDTH = 104;
const PULSE_REPEATS = 2;
/** Names fade in once the tree is zoomed in far enough to read them; area names stay longer. */
const FOCUS_LABEL_FADE_SCALES = [0.5, 0.68];
const BRANCH_LABEL_FADE_SCALES = [0.32, 0.45];
const DIMMED_OPACITY = 0.35;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

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
  isDimmed: boolean;
  isNew: boolean;
  /** Nodes further from you appear a little later, so the tree grows outward. */
  enterDelay: number;
  scale: SharedValue<number>;
  onPress: (id: string) => void;
  children?: ReactNode;
};

function nodeEntering(delay: number) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ scale: 0.85 }] },
      animations: {
        opacity: withDelay(
          delay,
          withTiming(1, { duration: 260, easing: EASE_OUT, reduceMotion: ReduceMotion.System }),
        ),
        transform: [
          {
            scale: withDelay(
              delay,
              withSpring(1, { duration: 420, dampingRatio: 0.75, reduceMotion: ReduceMotion.System }),
            ),
          },
        ],
      },
    };
  };
}

function hexAlpha(value: number) {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
}

/** Lit nodes glow brighter and wider the higher their level. */
function unlockedSurface(accent: string, size: number, level: number, isSelected: boolean): ViewStyle {
  const glowBlur = Math.round(size * (0.3 + level * 0.05));
  return {
    backgroundColor: `${accent}1f`,
    experimental_backgroundImage: `radial-gradient(circle at 32% 28%, ${accent}66 0%, ${accent}1a 62%, ${accent}0d 100%)`,
    borderColor: isSelected ? "#ffffff" : accent,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 0 ${glowBlur}px ${accent}${hexAlpha(0x33 + level * 13)}`,
  };
}

const LOCKED_SURFACE: ViewStyle = {
  backgroundColor: LOCKED_NODE_FILL,
  experimental_backgroundImage:
    "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.01) 100%)",
  borderColor: LOCKED_NODE_BORDER,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
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
  isDimmed,
  isNew,
  enterDelay,
  scale,
  onPress,
  children,
}: SkillTreeNodeProps) {
  const labelFadeScales = kind === "focus" ? FOCUS_LABEL_FADE_SCALES : BRANCH_LABEL_FADE_SCALES;
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.get(), labelFadeScales, [0, 1], Extrapolation.CLAMP),
  }));
  const showsLevel = isUnlocked && kind !== "center";
  const surface = isUnlocked
    ? unlockedSurface(accent, size, level, isSelected)
    : { ...LOCKED_SURFACE, borderColor: isSelected ? "#8a8a8a" : LOCKED_NODE_BORDER };

  return (
    <Animated.View
      entering={nodeEntering(enterDelay)}
      style={[styles.node, { left: x - size / 2, top: y - size / 2, width: size }]}
    >
      <Animated.View style={[styles.nodeBody, styles.dimmable, { opacity: isDimmed ? DIMMED_OPACITY : 1 }]}>
        {isNew ? <UnlockPulse size={size} accent={accent} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ selected: isSelected }}
          onPress={() => onPress(id)}
          hitSlop={8}
          testID={`skill-tree-node-${id}`}
        >
          {({ pressed }) => (
            <Animated.View
              style={[
                styles.nodeScaler,
                { transform: [{ scale: pressed ? 0.92 : isSelected ? 1.1 : 1 }] },
              ]}
            >
              {showsLevel ? (
                <LevelRing size={size} accent={accent} level={level} fraction={levelFraction} />
              ) : null}
              <Animated.View
                key={isUnlocked ? "lit" : "locked"}
                entering={isUnlocked ? FadeIn.duration(420).delay(enterDelay) : undefined}
                style={[styles.nodeCircle, { width: size, height: size }, surface]}
              >
                {children ??
                  (isUnlocked && Icon ? (
                    <Icon size={size * 0.42} color={accent} strokeWidth={2} />
                  ) : (
                    <Lock size={size * 0.32} color={LOCKED_ICON_COLOR} strokeWidth={2} />
                  ))}
              </Animated.View>
              {showsLevel ? (
                <Animated.View style={[styles.levelBadge, { backgroundColor: accent }]}>
                  <Text style={styles.levelBadgeText}>{level}</Text>
                </Animated.View>
              ) : null}
            </Animated.View>
          )}
        </Pressable>
        {kind === "center" ? null : (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.nodeLabelWrap,
              { top: size + RING_GAP + RING_WIDTH + 6, left: (size - LABEL_WIDTH) / 2, width: LABEL_WIDTH },
              labelStyle,
            ]}
          >
            <Text
              numberOfLines={2}
              style={[
                styles.nodeLabel,
                kind === "branch" && styles.branchLabel,
                { color: isUnlocked ? "#ffffff" : "#6b6b6b" },
              ]}
            >
              {label}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
});

/** One arc per level: finished levels are full, the current one fills with its progress. */
function LevelRing({
  size,
  accent,
  level,
  fraction,
}: {
  size: number;
  accent: string;
  level: number;
  fraction: number;
}) {
  const ringSize = size + RING_GAP * 2 + RING_WIDTH * 2;
  const center = ringSize / 2;
  const radius = (ringSize - RING_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentDegrees = 360 / LEVEL_COUNT;
  const arcLength = (circumference * (segmentDegrees - SEGMENT_GAP_DEGREES)) / 360;
  const offset = -(RING_GAP + RING_WIDTH);
  return (
    <Svg
      width={ringSize}
      height={ringSize}
      style={[styles.nodeRing, { left: offset, top: offset }]}
      pointerEvents="none"
    >
      {Array.from({ length: LEVEL_COUNT }, (_, index) => {
        const filled = segmentFill(index, level, fraction);
        const rotation = `rotate(${-90 + index * segmentDegrees + SEGMENT_GAP_DEGREES / 2} ${center} ${center})`;
        return (
          <Circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            stroke={filled > 0 ? accent : `${accent}2e`}
            strokeWidth={RING_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${arcLength * (filled > 0 ? filled : 1)} ${circumference}`}
            transform={rotation}
            fill="none"
          />
        );
      })}
    </Svg>
  );
}

function segmentFill(index: number, level: number, fraction: number): number {
  if (index < level - 1 || level >= LEVEL_COUNT) return 1;
  if (index > level - 1) return 0;
  return Math.max(0.08, fraction);
}

function UnlockPulse({ size, accent }: { size: number; accent: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(
      withDelay(
        900,
        withRepeat(withTiming(1, { duration: 1400, easing: EASE_OUT }), PULSE_REPEATS),
      ),
    );
  }, [progress, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [1, 1.7]) }],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.nodePulse, { width: size, height: size, borderColor: accent }, pulseStyle]}
    />
  );
}
