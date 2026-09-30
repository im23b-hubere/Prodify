import { memo } from "react";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { colors } from "../../../constants/theme";
import { isSkillBranch } from "../../../constants/skills";
import { styles, LOCKED_EDGE_COLOR } from "../skillTree.styles";
import type { SkillTreeEdgeLayout, SkillTreeLayout } from "../skillTreeLayout";
import type { SkillTreeModel } from "../skillTreePresentation";

type SkillTreeEdgesProps = {
  layout: SkillTreeLayout;
  model: SkillTreeModel;
  /** The full tree draws a soft glow and orbit guides; the mini map stays flat. */
  isDetailed?: boolean;
  /** Drawn size on screen; the tree scales to fit it. */
  renderSize?: number;
};

function isEdgeUnlocked(model: SkillTreeModel, toId: SkillTreeEdgeLayout["toId"]): boolean {
  return isSkillBranch(toId) ? model.branches[toId].isUnlocked : model.focuses[toId].isUnlocked;
}

export const SkillTreeEdges = memo(function SkillTreeEdges({
  layout,
  model,
  isDetailed = true,
  renderSize = layout.size,
}: SkillTreeEdgesProps) {
  const center = layout.size / 2;
  const strokeScale = isDetailed ? 1 : layout.size / renderSize / 2;
  return (
    <Svg
      width={renderSize}
      height={renderSize}
      viewBox={`0 0 ${layout.size} ${layout.size}`}
      style={styles.layerFill}
      pointerEvents="none"
    >
      {isDetailed ? (
        <>
          <Defs>
            <RadialGradient id="skillTreeGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.16} />
              <Stop offset="0.45" stopColor={colors.secondary} stopOpacity={0.05} />
              <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={center} cy={center} r={center} fill="url(#skillTreeGlow)" />
          {layout.ringRadii.map((radius) => (
            <Circle
              key={radius}
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(255,255,255,0.035)"
              strokeWidth={1}
              fill="none"
            />
          ))}
        </>
      ) : null}
      {isDetailed
        ? layout.edges
            .filter((edge) => isEdgeUnlocked(model, edge.toId))
            .map((edge) => (
              <Path
                key={`${edge.id}-glow`}
                d={edge.path}
                stroke={sessionTypeAccent(edge.branch)}
                strokeOpacity={0.14}
                strokeWidth={9}
                strokeLinecap="round"
                fill="none"
              />
            ))
        : null}
      {layout.edges.map((edge) => {
        const accent = sessionTypeAccent(edge.branch);
        if (!isEdgeUnlocked(model, edge.toId)) {
          return (
            <Path
              key={edge.id}
              d={edge.path}
              stroke={LOCKED_EDGE_COLOR}
              strokeWidth={1.5 * strokeScale}
              strokeDasharray={isDetailed ? "4 7" : undefined}
              fill="none"
            />
          );
        }
        return (
          <Path
            key={edge.id}
            d={edge.path}
            stroke={accent}
            strokeOpacity={0.85}
            strokeWidth={2 * strokeScale}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
});
