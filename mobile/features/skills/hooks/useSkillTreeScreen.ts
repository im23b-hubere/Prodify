import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SkillFocusId } from "../../../constants/skills";
import { useAuth } from "../../../context/AuthContext";
import { SKILL_TREE_LAYOUT } from "../skillTreeLayout";
import {
  buildSkillTreeModel,
  highlightedNodeIds,
  neglectedFocus,
  startingNodeId,
  unlockedFocusIds,
  type SkillTreeNodeId,
} from "../skillTreePresentation";
import { useNewlyUnlockedSkills } from "./useNewlyUnlockedSkills";
import { useSkillProfile } from "./useSkillProfile";
import { useSkillTreeViewport } from "./useSkillTreeViewport";

export type { SkillTreeNodeId };
export type SkillTreeViewMode = "tree" | "list";

/** Keeps a focused node above the detail card that slides up from the bottom. */
const DETAIL_CARD_LIFT = 110;

const NODE_POSITIONS = new Map(SKILL_TREE_LAYOUT.nodes.map((node) => [node.id, node]));

export function useSkillTreeScreen(initialBranch: string | undefined) {
  const { token, user } = useAuth();
  const skillProfile = useSkillProfile(token);
  const model = useMemo(() => buildSkillTreeModel(skillProfile.profile), [skillProfile.profile]);
  const viewport = useSkillTreeViewport(SKILL_TREE_LAYOUT.size);
  const [selectedId, setSelectedId] = useState<SkillTreeNodeId | null>(null);
  const [viewMode, setViewMode] = useState<SkillTreeViewMode>("tree");
  const highlighted = useMemo(() => highlightedNodeIds(selectedId), [selectedId]);
  const isReady = skillProfile.profile !== null;
  const newlyUnlocked = useNewlyUnlockedSkills(
    user?.id,
    isReady ? unlockedFocusIds(model) : null,
  );

  const { focusOn, introduce, isMeasured } = viewport;
  const startId = startingNodeId(model, initialBranch);
  const hasIntroduced = useRef(false);
  useEffect(() => {
    if (hasIntroduced.current || !isReady || !isMeasured) return;
    hasIntroduced.current = true;
    const startNode = NODE_POSITIONS.get(startId);
    if (startNode) introduce(startNode);
  }, [introduce, isMeasured, isReady, startId]);

  const firstNewUnlock = newlyUnlocked.values().next().value;
  const hasCelebrated = useRef(false);
  useEffect(() => {
    if (hasCelebrated.current || !firstNewUnlock || !isMeasured) return;
    hasCelebrated.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const node = NODE_POSITIONS.get(firstNewUnlock);
    if (node) focusOn(node);
  }, [firstNewUnlock, focusOn, isMeasured]);

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
    highlighted,
    selectNode,
    clearSelection: () => setSelectedId(null),
    viewMode,
    toggleViewMode: () => setViewMode((mode) => (mode === "tree" ? "list" : "tree")),
    neglected: isReady ? neglectedFocus(model, new Date()) : null,
    showFocus,
    newlyUnlocked,
    showFirstNewUnlock: firstNewUnlock ? () => showFocus(firstNewUnlock) : null,
  };
}

export type SkillTreeScreenState = ReturnType<typeof useSkillTreeScreen>;
