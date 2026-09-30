import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { SKILL_BRANCH_ICONS, SKILL_FOCUS_ICONS } from "../../../constants/skillIcons";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import type { SkillTreeScreenState } from "../hooks/useSkillTreeScreen";
import { styles } from "../skillTree.styles";
import { SKILL_TREE_LAYOUT, type SkillTreeNodeLayout } from "../skillTreeLayout";
import { SkillTreeEdges } from "./SkillTreeEdges";
import { SkillTreeNode } from "./SkillTreeNode";

export function SkillTreeCanvas({ screen }: { screen: SkillTreeScreenState }) {
  const { viewport, model } = screen;
  const { size } = SKILL_TREE_LAYOUT;
  return (
    <GestureDetector gesture={viewport.gesture}>
      <View
        style={styles.viewport}
        onLayout={viewport.onLayout}
        collapsable={false}
        testID="skill-tree-viewport"
      >
        {viewport.isMeasured ? (
          <Animated.View
            style={[
              styles.canvas,
              { width: size, height: size, ...viewport.canvasOffset },
              viewport.canvasStyle,
            ]}
          >
            <SkillTreeEdges layout={SKILL_TREE_LAYOUT} model={model} />
            {SKILL_TREE_LAYOUT.nodes.map((node) => (
              <TreeNode key={node.id} node={node} screen={screen} />
            ))}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

function TreeNode({ node, screen }: { node: SkillTreeNodeLayout; screen: SkillTreeScreenState }) {
  const { t } = useTranslation();
  const { model, selectedId, selectNode, viewport } = screen;
  const shared = {
    id: node.id,
    kind: node.kind,
    x: node.x,
    y: node.y,
    size: node.size,
    isSelected: selectedId === node.id,
    scale: viewport.scale,
    onPress: selectNode as (id: string) => void,
  };

  if (node.kind === "center") {
    return (
      <SkillTreeNode
        {...shared}
        accent={colors.primary}
        label={t("skillTree.you")}
        accessibilityLabel={t("skillTree.centerTitle")}
        isUnlocked={model.totalSeconds > 0}
        level={0}
        levelFraction={0}
        isNew={false}
      >
        <Text style={styles.centerLabel}>{t("skillTree.you")}</Text>
        <Text style={styles.centerCount}>
          {model.unlockedFocusCount}
          <Text style={styles.centerTotal}>/{model.focusCount}</Text>
        </Text>
      </SkillTreeNode>
    );
  }

  const state = node.kind === "branch" ? model.branches[node.id] : model.focuses[node.id];
  const name =
    node.kind === "branch" ? sessionTypeLabel(node.id, t) : skillFocusText(node.id, "label", t);
  return (
    <SkillTreeNode
      {...shared}
      accent={sessionTypeAccent(node.branch)}
      Icon={node.kind === "branch" ? SKILL_BRANCH_ICONS[node.id] : SKILL_FOCUS_ICONS[node.id]}
      label={node.kind === "branch" ? name : skillFocusText(node.id, "short", t)}
      accessibilityLabel={
        state.isUnlocked
          ? t("skillTree.nodeAccessibility", { name, level: state.level })
          : t("skillTree.nodeLockedAccessibility", { name })
      }
      accessibilityHint={node.kind === "focus" ? skillFocusText(node.id, "covers", t) : undefined}
      isUnlocked={state.isUnlocked}
      level={state.level}
      levelFraction={state.levelFraction}
      isNew={node.kind === "focus" && screen.newlyUnlocked.has(node.id)}
    />
  );
}
