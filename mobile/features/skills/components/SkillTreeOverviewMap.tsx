import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import type { SkillTreeScreenState } from "../hooks/useSkillTreeScreen";
import { styles } from "../skillTree.styles";
import { SKILL_TREE_LAYOUT } from "../skillTreeLayout";
import { SkillTreeMiniMap } from "./SkillTreeMiniMap";

const MAP_SIZE = 64;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/** A thumbnail of the whole tree with a frame around what is on screen; tapping zooms out. */
export function SkillTreeOverviewMap({ screen }: { screen: SkillTreeScreenState }) {
  const { t } = useTranslation();
  const { viewport, model, clearSelection } = screen;
  const { scale, translateX, translateY, showWholeTree } = viewport;
  const treeSize = SKILL_TREE_LAYOUT.size;
  const mapRatio = MAP_SIZE / treeSize;
  const viewportWidth = viewport.viewportSize?.width ?? 0;
  const viewportHeight = viewport.viewportSize?.height ?? 0;

  const frameStyle = useAnimatedStyle(() => {
    const currentScale = scale.get();
    const visibleWidth = Math.min(treeSize, viewportWidth / currentScale);
    const visibleHeight = Math.min(treeSize, viewportHeight / currentScale);
    const centerX = treeSize / 2 - translateX.get() / currentScale;
    const centerY = treeSize / 2 - translateY.get() / currentScale;
    return {
      width: visibleWidth * mapRatio,
      height: visibleHeight * mapRatio,
      transform: [
        { translateX: clamp((centerX - visibleWidth / 2) * mapRatio, 0, MAP_SIZE - visibleWidth * mapRatio) },
        { translateY: clamp((centerY - visibleHeight / 2) * mapRatio, 0, MAP_SIZE - visibleHeight * mapRatio) },
      ],
    };
  });

  const showEverything = () => {
    Haptics.selectionAsync().catch(() => undefined);
    clearSelection();
    showWholeTree();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("skillTree.showWholeTree")}
      onPress={showEverything}
      style={({ pressed }) => [styles.overviewMap, pressed && styles.pressed]}
      testID="skill-tree-overview"
    >
      <View style={{ width: MAP_SIZE, height: MAP_SIZE }}>
        <SkillTreeMiniMap model={model} size={MAP_SIZE} />
        <Animated.View pointerEvents="none" style={[styles.overviewFrame, frameStyle]} />
      </View>
    </Pressable>
  );
}
