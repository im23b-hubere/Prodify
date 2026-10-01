import { memo } from "react";
import Svg, { Path } from "react-native-svg";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { styles, LOCKED_EDGE_COLOR } from "../skillTree.styles";
import type { SkillTreeLayout } from "../skillTreeLayout";
import { isEdgeUnlocked, type SkillTreeModel } from "../skillTreePresentation";

type SkillTreeEdgesProps = {
  layout: SkillTreeLayout;
  model: SkillTreeModel;
  /** Drawn size on screen; the tree scales to fit it. */
  renderSize: number;
};

/** Flat edges for thumbnails; strokes stay about one pixel wide whatever the size. */
export const SkillTreeEdges = memo(function SkillTreeEdges({
  layout,
  model,
  renderSize,
}: SkillTreeEdgesProps) {
  const strokeScale = layout.size / renderSize / 2;
  return (
    <Svg
      width={renderSize}
      height={renderSize}
      viewBox={`0 0 ${layout.size} ${layout.size}`}
      style={styles.layerFill}
      pointerEvents="none"
    >
      {layout.edges.map((edge) =>
        isEdgeUnlocked(model, edge.toId) ? (
          <Path
            key={edge.id}
            d={edge.path}
            stroke={sessionTypeAccent(edge.branch)}
            strokeOpacity={0.85}
            strokeWidth={2 * strokeScale}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <Path
            key={edge.id}
            d={edge.path}
            stroke={LOCKED_EDGE_COLOR}
            strokeWidth={1.5 * strokeScale}
            fill="none"
          />
        ),
      )}
    </Svg>
  );
});
