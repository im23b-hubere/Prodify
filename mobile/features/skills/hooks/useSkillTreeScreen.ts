import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";

import { isSkillBranch, type SkillBranch, type SkillFocusId } from "../../../constants/skills";
import { useAuth } from "../../../context/AuthContext";
import { SKILL_TREE_LAYOUT } from "../skillTreeLayout";
import {
  buildSkillTreeModel,
  neglectedFocus,
  unlockedFocusIds,
} from "../skillTreePresentation";
import { useNewlyUnlockedSkills } from "./useNewlyUnlockedSkills";
import { useSkillProfile } from "./useSkillProfile";
import { useSkillTreeViewport } from "./useSkillTreeViewport";

export type SkillTreeNodeId = "center" | SkillBranch | SkillFocusId;
export type SkillTreeViewMode = "tree" | "list";

/** Keeps a focused node above the detail card that slides up from the bottom. */
const DETAIL_CARD_LIFT = 110;

const NODE_POSITIONS = new Map(SKILL_TREE_LAYOUT.nodes.map((node) => [node.id, node]));

export function useSkillTreeScreen(initialBranch: string | undefined) {
  const { token, user } = useAuth();
  const skillProfile = useSkillProfile(token);
  const model = buildSkillTreeModel(skillProfile.profile);
  const viewport = useSkillTreeViewport(SKILL_TREE_LAYOUT.size);
  const [selectedId, setSelectedId] = useState<SkillTreeNodeId | null>(null);
  const [viewMode, setViewMode] = useState<SkillTreeViewMode>("tree");
  const isReady = skillProfile.profile !== null;
  const newlyUnlocked = useNewlyUnlockedSkills(
    user?.id,
    isReady ? unlockedFocusIds(model) : null,
  );

  const { focusOn, isMeasured } = viewport;
  const hasFocusedInitialBranch = useRef(false);
  useEffect(() => {
    if (hasFocusedInitialBranch.current || !isReady || !isMeasured) return;
    if (!isSkillBranch(initialBranch)) return;
    hasFocusedInitialBranch.current = true;
    const branchNode = NODE_POSITIONS.get(initialBranch);
    if (branchNode) focusOn(branchNode);
  }, [focusOn, initialBranch, isMeasured, isReady]);

  const selectNode = useCallback(
    (id: SkillTreeNodeId) => {
      Haptics.selectionAsync().catch(() => undefined);
      setSelectedId((current) => (current === id ? null : id));
      const node = NODE_POSITIONS.get(id);
      if (node && id !== "center") focusOn(node, DETAIL_CARD_LIFT);
    },
    [focusOn],
  );

  const showFocus = (id: SkillFocusId) => {
    setViewMode("tree");
    selectNode(id);
  };

  return {
    model,
    loadState: skillProfile.loadState,
    isReady,
    retry: skillProfile.retry,
    viewport,
    selectedId,
    selectNode,
    clearSelection: () => setSelectedId(null),
    viewMode,
    toggleViewMode: () => setViewMode((mode) => (mode === "tree" ? "list" : "tree")),
    neglected: isReady ? neglectedFocus(model, new Date()) : null,
    showFocus,
    newlyUnlocked,
  };
}

export type SkillTreeScreenState = ReturnType<typeof useSkillTreeScreen>;
