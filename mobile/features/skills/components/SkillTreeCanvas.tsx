import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { sessionTypeAccent } from "../../../components/session/SkillFocusChips";
import { SKILL_BRANCH_ICONS, SKILL_FOCUS_ICONS } from "../../../constants/skillIcons";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { skillFocusText } from "../../../lib/skillI18n";
import type { SkillTreeScreenState } from "../hooks/useSkillTreeScreen";
import { styles } from "../skillTree.styles";
import { SKILL_TREE_LAYOUT, type SkillTreeNodeLayout } from "../skillTreeLayout";
import { SkillTreeLinks } from "./SkillTreeLinks";
import { SkillTreeNode } from "./SkillTreeNode";

const REVEAL_TIMING = {
  duration: 900,
  easing: Easing.bezier(0.77, 0, 0.175, 1),
  reduceMotion: ReduceMotion.System,
};
const ENTER_BASE_DELAY = 40;
const ENTER_DELAY_PER_POINT = 0.75;

/** Traces the unlocked edges in once the profile has arrived. */
function useTreeReveal(isReady: boolean) {
  const reveal = useSharedValue(0);
  useEffect(() => {
    if (isReady) reveal.set(withTiming(1, REVEAL_TIMING));
  }, [isReady, reveal]);
  return reveal;
}

function enterDelayFor(node: SkillTreeNodeLayout) {
  const center = SKILL_TREE_LAYOUT.size / 2;
  return ENTER_BASE_DELAY + Math.hypot(node.x - center, node.y - center) * ENTER_DELAY_PER_POINT;
}

export function SkillTreeCanvas({ screen }: { screen: SkillTreeScreenState }) {
  const { viewport, model, highlighted, isReady } = screen;
  const { size } = SKILL_TREE_LAYOUT;
  const reveal = useTreeReveal(isReady);
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
            <SkillTreeLinks
              layout={SKILL_TREE_LAYOUT}
              model={model}
              reveal={reveal}
              highlighted={highlighted}
            />
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
  const { model, selectedId, selectNode, viewport, highlighted } = screen;
  const shared = {
    id: node.id,
    kind: node.kind,
    x: node.x,
    y: node.y,
    size: node.size,
    isSelected: selectedId === node.id,
    isDimmed: highlighted !== null && !highlighted.has(node.id),
    enterDelay: enterDelayFor(node),
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
