import { memo } from "react";
import { View } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { colors, motion } from "../../../constants/theme";
import { isSkillBranch } from "../../../constants/skills";
import { LOCKED_EDGE_COLOR, styles } from "../skillTree.styles";
import type { SkillTreeEdgeLayout, SkillTreeLayout } from "../skillTreeLayout";
import {
  isEdgeUnlocked,
  type SkillTreeModel,
  type SkillTreeNodeId,
} from "../skillTreePresentation";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Parts of the intro progress in which each ring of edges traces itself in. */
const BRANCH_EDGE_WINDOW = [0, 0.5];
const FOCUS_EDGE_WINDOW = [0.35, 1];
const DIMMED_OPACITY = 0.3;
const HIGHLIGHTED_LOCKED_EDGE = "#5a5a5a";

type SkillTreeLinksProps = {
  layout: SkillTreeLayout;
  model: SkillTreeModel;
  /** 0–1 intro progress; unlocked edges trace in from you outward. */
  reveal: SharedValue<number>;
  highlighted: ReadonlySet<SkillTreeNodeId> | null;
};

function gradientId(edge: SkillTreeEdgeLayout) {
  return `skillTreeEdge-${edge.id.replace(/\./g, "_")}`;
}

function edgeLevel(model: SkillTreeModel, toId: SkillTreeEdgeLayout["toId"]) {
  return isSkillBranch(toId) ? model.branches[toId].level : model.focuses[toId].level;
}

/** Thicker strokes for more trained skills; never thinner than a pixel when zoomed out. */
function edgeWidth(level: number) {
  return 2.4 + (level - 1) * 0.35;
}

export const SkillTreeLinks = memo(function SkillTreeLinks({
  layout,
  model,
  reveal,
  highlighted,
}: SkillTreeLinksProps) {
  const unlockedEdges = layout.edges.filter((edge) => isEdgeUnlocked(model, edge.toId));
  const lockedEdges = layout.edges.filter((edge) => !isEdgeUnlocked(model, edge.toId));
  return (
    <>
      <TreeBackdrop size={layout.size} />
      <Animated.View
        style={[
          styles.layerFill,
          styles.dimmable,
          { width: layout.size, height: layout.size, opacity: highlighted ? DIMMED_OPACITY : 1 },
        ]}
        pointerEvents="none"
      >
        <Svg width={layout.size} height={layout.size}>
          <Defs>
            {unlockedEdges.map((edge) => (
              <EdgeGradient key={edge.id} edge={edge} />
            ))}
          </Defs>
          {lockedEdges.map((edge) => (
            <Path
              key={edge.id}
              d={edge.path}
              stroke={LOCKED_EDGE_COLOR}
              strokeWidth={2}
              strokeDasharray="4 7"
              fill="none"
            />
          ))}
          {unlockedEdges.map((edge) => (
            <EdgeTrace
              key={edge.id}
              edge={edge}
              width={edgeWidth(edgeLevel(model, edge.toId))}
              reveal={reveal}
            />
          ))}
        </Svg>
      </Animated.View>
      {highlighted ? (
        <HighlightedEdges layout={layout} model={model} highlighted={highlighted} />
      ) : null}
    </>
  );
});

function TreeBackdrop({ size }: { size: number }) {
  const center = size / 2;
  return (
    <View style={styles.layerFill} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <Pattern id="skillTreeDots" width={26} height={26} patternUnits="userSpaceOnUse">
            <Circle cx={13} cy={13} r={1.2} fill="rgba(255,255,255,0.08)" />
          </Pattern>
          <RadialGradient id="skillTreeGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="0.45" stopColor={colors.secondary} stopOpacity={0.05} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="skillTreeVignette" cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Circle cx={center} cy={center} r={center} fill="url(#skillTreeDots)" />
        <Circle cx={center} cy={center} r={center} fill="url(#skillTreeGlow)" />
        <Circle cx={center} cy={center} r={center} fill="url(#skillTreeVignette)" />
      </Svg>
    </View>
  );
}

function EdgeGradient({ edge }: { edge: SkillTreeEdgeLayout }) {
  const accent = sessionTypeAccent(edge.branch);
  const startsAtYou = isSkillBranch(edge.toId);
  return (
    <LinearGradient
      id={gradientId(edge)}
      gradientUnits="userSpaceOnUse"
      x1={edge.from.x}
      y1={edge.from.y}
      x2={edge.to.x}
      y2={edge.to.y}
    >
      <Stop offset="0" stopColor={startsAtYou ? colors.primary : accent} stopOpacity={0.95} />
      <Stop offset="1" stopColor={accent} stopOpacity={startsAtYou ? 0.95 : 0.55} />
    </LinearGradient>
  );
}

const EdgeTrace = memo(function EdgeTrace({
  edge,
  width,
  reveal,
}: {
  edge: SkillTreeEdgeLayout;
  width: number;
  reveal: SharedValue<number>;
}) {
  const window = isSkillBranch(edge.toId) ? BRANCH_EDGE_WINDOW : FOCUS_EDGE_WINDOW;
  const traceProps = useAnimatedProps(() => ({
    strokeDashoffset:
      edge.length * (1 - interpolate(reveal.get(), window, [0, 1], Extrapolation.CLAMP)),
  }));
  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset:
      edge.length * (1 - interpolate(reveal.get(), window, [0, 1], Extrapolation.CLAMP)),
  }));
  const dash = [edge.length, edge.length];
  return (
    <>
      <AnimatedPath
        d={edge.path}
        stroke={sessionTypeAccent(edge.branch)}
        strokeOpacity={0.12}
        strokeWidth={width * 4}
        strokeLinecap="round"
        strokeDasharray={dash}
        animatedProps={glowProps}
        fill="none"
      />
      <AnimatedPath
        d={edge.path}
        stroke={`url(#${gradientId(edge)})`}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dash}
        animatedProps={traceProps}
        fill="none"
      />
    </>
  );
});

/** The selected path drawn again at full strength above the dimmed tree. */
function HighlightedEdges({
  layout,
  model,
  highlighted,
}: {
  layout: SkillTreeLayout;
  model: SkillTreeModel;
  highlighted: ReadonlySet<SkillTreeNodeId>;
}) {
  const edges = layout.edges.filter((edge) => highlighted.has(edge.toId));
  return (
    <Animated.View
      entering={FadeIn.duration(motion.quick)}
      exiting={FadeOut.duration(motion.quick)}
      style={styles.layerFill}
      pointerEvents="none"
    >
      <Svg width={layout.size} height={layout.size}>
        {edges.map((edge) =>
          isEdgeUnlocked(model, edge.toId) ? (
            <Path
              key={edge.id}
              d={edge.path}
              stroke={sessionTypeAccent(edge.branch)}
              strokeWidth={edgeWidth(edgeLevel(model, edge.toId)) + 1}
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <Path
              key={edge.id}
              d={edge.path}
              stroke={HIGHLIGHTED_LOCKED_EDGE}
              strokeWidth={2}
              strokeDasharray="4 7"
              fill="none"
            />
          ),
        )}
      </Svg>
    </Animated.View>
  );
}
