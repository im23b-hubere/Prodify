import { memo } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { colors } from "../../../constants/theme";
import { LOCKED_NODE_BORDER } from "../skillTree.styles";
import { SKILL_TREE_LAYOUT, type SkillTreeNodeLayout } from "../skillTreeLayout";
import type { SkillTreeModel } from "../skillTreePresentation";
import { SkillTreeEdges } from "./SkillTreeEdges";

function isNodeUnlocked(model: SkillTreeModel, node: SkillTreeNodeLayout): boolean {
  if (node.kind === "center") return model.totalSeconds > 0;
  if (node.kind === "branch") return model.branches[node.id].isUnlocked;
  return model.focuses[node.id].isUnlocked;
}

/** A static thumbnail of the tree: lit dots for unlocked skills, dark ones for the rest. */
export const SkillTreeMiniMap = memo(function SkillTreeMiniMap({
  model,
  size,
}: {
  model: SkillTreeModel;
  size: number;
}) {
  const { size: treeSize } = SKILL_TREE_LAYOUT;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkillTreeEdges layout={SKILL_TREE_LAYOUT} model={model} isDetailed={false} renderSize={size} />
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${treeSize} ${treeSize}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {SKILL_TREE_LAYOUT.nodes.map((node) => {
          const isUnlocked = isNodeUnlocked(model, node);
          const accent = node.kind === "center" ? colors.primary : sessionTypeAccent(node.branch);
          return (
            <Circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={node.size / 2}
              fill={isUnlocked ? accent : colors.surface}
              stroke={isUnlocked ? accent : LOCKED_NODE_BORDER}
              strokeWidth={4}
            />
          );
        })}
      </Svg>
    </View>
  );
});
