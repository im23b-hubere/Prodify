import { memo, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Extrapolation,
  FadeOut,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
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
import { dimTransition, LOCKED_EDGE_COLOR, styles } from "../skillTree.styles";
import {
  edgesBounds,
  type SkillTreeEdgeLayout,
  type SkillTreeLabelBox,
  type SkillTreeLayout,
} from "../skillTreeLayout";
import {
  isEdgeUnlocked,
  tracedEdgeToIds,
  type SkillTreeModel,
  type SkillTreeNodeId,
} from "../skillTreePresentation";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DIMMED_OPACITY = 0.3;
/** Clip scale while hidden; never 0, the content's counter-scale divides by it. */
const HIDDEN_REVEAL = 0.001;
/** Room past an edge's centre line for its widest stroke (the glow) and its round caps. */
const EDGE_STROKE_PAD = 12;
const HIGHLIGHTED_LOCKED_EDGE = "#5a5a5a";

type SkillTreeLinksProps = {
  layout: SkillTreeLayout;
  model: SkillTreeModel;
  /** 0–1 intro progress; the edges are uncovered from you outward. */
  reveal: SharedValue<number>;
  /** The intro has finished, so the edges no longer need clipping. */
  isRevealed: boolean;
  /** 0–1 retrace of the selected path. */
  pathReveal: SharedValue<number>;
  selectedId: SkillTreeNodeId | null;
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
  isRevealed,
  pathReveal,
  selectedId,
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
          dimTransition,
          { width: layout.size, height: layout.size, opacity: highlighted ? DIMMED_OPACITY : 1 },
        ]}
        pointerEvents="none"
      >
        <RadialReveal size={layout.size} reveal={reveal} isRevealed={isRevealed}>
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
              <LitEdge key={edge.id} edge={edge} width={edgeWidth(edgeLevel(model, edge.toId))} />
            ))}
          </Svg>
        </RadialReveal>
      </Animated.View>
      {highlighted ? (
        <HighlightedEdges
          layout={layout}
          model={model}
          highlighted={highlighted}
          selectedId={selectedId}
          pathReveal={pathReveal}
        />
      ) : null}
    </>
  );
});

/**
 * Uncovers the edges in a circle growing out from you. Only the clip moves, on the GPU; the
 * tree-sized SVG underneath is drawn once instead of every frame. Once open the clip is
 * dropped, so camera moves don't pay for it.
 */
function RadialReveal({
  size,
  reveal,
  isRevealed,
  children,
}: {
  size: number;
  reveal: SharedValue<number>;
  isRevealed: boolean;
  children: ReactNode;
}) {
  const clipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.max(reveal.get(), HIDDEN_REVEAL) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / Math.max(reveal.get(), HIDDEN_REVEAL) }],
  }));
  return (
    <Animated.View
      style={[
        { width: size, height: size },
        !isRevealed && { borderRadius: size / 2, overflow: "hidden" },
        clipStyle,
      ]}
    >
      <Animated.View style={contentStyle}>{children}</Animated.View>
    </Animated.View>
  );
}

/** An SVG covering only `box` of the canvas, so it draws (and redraws) just that part. */
function BoxedSvg({ box, children }: { box: SkillTreeLabelBox; children: ReactNode }) {
  return (
    <Svg
      width={box.width}
      height={box.height}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      style={[styles.layerFill, { left: box.x, top: box.y }]}
    >
      {children}
    </Svg>
  );
}

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

/** An unlocked edge at rest: a soft glow under a line that fades from one end to the other. */
const LitEdge = memo(function LitEdge({
  edge,
  width,
}: {
  edge: SkillTreeEdgeLayout;
  width: number;
}) {
  return (
    <>
      <Path
        d={edge.path}
        stroke={sessionTypeAccent(edge.branch)}
        strokeOpacity={0.12}
        strokeWidth={width * 4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={edge.path}
        stroke={`url(#${gradientId(edge)})`}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
});

/** An edge drawing itself in from its start while `reveal` runs through `traceWindow`. */
const EdgeTrace = memo(function EdgeTrace({
  edge,
  width,
  reveal,
  traceWindow,
  stroke,
}: {
  edge: SkillTreeEdgeLayout;
  width: number;
  reveal: SharedValue<number>;
  traceWindow: readonly [number, number];
  stroke: string;
}) {
  const traceProps = useAnimatedProps(() => ({
    strokeDashoffset:
      edge.length * (1 - interpolate(reveal.get(), traceWindow, [0, 1], Extrapolation.CLAMP)),
  }));
  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset:
      edge.length * (1 - interpolate(reveal.get(), traceWindow, [0, 1], Extrapolation.CLAMP)),
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
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dash}
        animatedProps={traceProps}
        fill="none"
      />
    </>
  );
});

function pathWindow(index: number, count: number): readonly [number, number] {
  if (count <= 1) return [0, 1];
  return index === 0 ? [0, 0.55] : [0.4, 1];
}

/** The selected path drawn again at full strength above the dimmed tree. */
function HighlightedEdges({
  layout,
  model,
  highlighted,
  selectedId,
  pathReveal,
}: {
  layout: SkillTreeLayout;
  model: SkillTreeModel;
  highlighted: ReadonlySet<SkillTreeNodeId>;
  selectedId: SkillTreeNodeId | null;
  pathReveal: SharedValue<number>;
}) {
  const tracedToIds = tracedEdgeToIds(selectedId);
  const tracedIdSet = new Set(tracedToIds);
  const tracedEdges = tracedToIds
    .map((toId) => layout.edges.find((edge) => edge.toId === toId))
    .filter((edge): edge is SkillTreeEdgeLayout => edge !== undefined);
  const fanEdges = layout.edges.filter(
    (edge) => highlighted.has(edge.toId) && !tracedIdSet.has(edge.toId),
  );
  return (
    <Animated.View
      exiting={FadeOut.duration(motion.quick)}
      style={styles.layerFill}
      pointerEvents="none"
    >
      {/* Two small layers instead of one the size of the tree: the fan sits still and the
          traced path animates, so each frame redraws only the path's own box. */}
      {fanEdges.length > 0 ? (
        <BoxedSvg box={edgesBounds(fanEdges, EDGE_STROKE_PAD)}>
          {fanEdges.map((edge) => (
            <HighlightedEdge key={edge.id} edge={edge} model={model} />
          ))}
        </BoxedSvg>
      ) : null}
      {tracedEdges.length > 0 ? (
        <BoxedSvg box={edgesBounds(tracedEdges, EDGE_STROKE_PAD)}>
          {tracedEdges.map((edge, index) =>
            isEdgeUnlocked(model, edge.toId) ? (
              <EdgeTrace
                key={edge.id}
                edge={edge}
                width={edgeWidth(edgeLevel(model, edge.toId)) + 1}
                reveal={pathReveal}
                traceWindow={pathWindow(index, tracedEdges.length)}
                stroke={sessionTypeAccent(edge.branch)}
              />
            ) : (
              <HighlightedEdge key={edge.id} edge={edge} model={model} />
            ),
          )}
        </BoxedSvg>
      ) : null}
    </Animated.View>
  );
}

function HighlightedEdge({
  edge,
  model,
}: {
  edge: SkillTreeEdgeLayout;
  model: SkillTreeModel;
}) {
  if (!isEdgeUnlocked(model, edge.toId)) {
    return (
      <Path
        d={edge.path}
        stroke={HIGHLIGHTED_LOCKED_EDGE}
        strokeWidth={2}
        strokeDasharray="4 7"
        fill="none"
      />
    );
  }
  return (
    <Path
      d={edge.path}
      stroke={sessionTypeAccent(edge.branch)}
      strokeWidth={edgeWidth(edgeLevel(model, edge.toId)) + 1}
      strokeLinecap="round"
      fill="none"
    />
  );
}
