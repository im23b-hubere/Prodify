import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { isSkillBranch, type SkillFocusId } from "../../../constants/skills";
import { useAuth } from "../../../context/AuthContext";
import { SKILL_TREE_LAYOUT } from "../skillTreeLayout";
import {
  buildSkillTreeModel,
  highlightedNodeIds,
  neglectedFocus,
  startingNodeId,
  unlockCountStart,
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
const UNLOCK_COUNT_TICK_MS = 420;

function lightSnap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** The You-node count starts on last visit's total, then ticks up once seen is known. */
function useDisplayedUnlockCount(unlocked: number, newCount: number, hasResolved: boolean) {
  const from = unlockCountStart(unlocked, newCount);
  const [shown, setShown] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!hasResolved) {
      setShown(null);
      return;
    }
    setShown(newCount > 0 ? from : unlocked);
  }, [from, hasResolved, newCount, unlocked]);

  useEffect(() => {
    if (!hasResolved || newCount === 0 || from === unlocked) return;
    const id = setTimeout(() => setShown(unlocked), UNLOCK_COUNT_TICK_MS);
    return () => clearTimeout(id);
  }, [from, hasResolved, newCount, unlocked]);

  if (!hasResolved) return null;
  return shown ?? (newCount > 0 ? from : unlocked);
}

export function useSkillTreeScreen(initialBranch: string | undefined) {
  const { token, user } = useAuth();
  const skillProfile = useSkillProfile(token);
  const model = useMemo(() => buildSkillTreeModel(skillProfile.profile), [skillProfile.profile]);
  const [selectedId, setSelectedId] = useState<SkillTreeNodeId | null>(null);
  const showDetailsOf = useCallback((id: SkillTreeNodeId | null) => {
    if (id && id !== "center") lightSnap();
    setSelectedId(id);
  }, []);
  const viewport = useSkillTreeViewport(SKILL_TREE_LAYOUT, {
    selectionLift: DETAIL_CARD_LIFT,
    onTap: showDetailsOf,
  });
  const [viewMode, setViewMode] = useState<SkillTreeViewMode>("tree");
  const highlighted = useMemo(() => highlightedNodeIds(selectedId), [selectedId]);
  const isReady = skillProfile.profile !== null;
  const newlyUnlocked = useNewlyUnlockedSkills(user?.id, isReady ? unlockedFocusIds(model) : null);
  const displayedUnlockCount = useDisplayedUnlockCount(
    model.unlockedFocusCount,
    newlyUnlocked.ids.size,
    newlyUnlocked.hasResolved,
  );

  const { fitArea, fitFocus, introduce, isMeasured } = viewport;
  const startId = startingNodeId(model, initialBranch);
  const hasIntroduced = useRef(false);
  useEffect(() => {
    if (hasIntroduced.current || !isReady || !isMeasured) return;
    hasIntroduced.current = true;
    introduce(startId);
  }, [introduce, isMeasured, isReady, startId]);

  const firstNewUnlock = newlyUnlocked.ids.values().next().value;
  const hasCelebrated = useRef(false);
  useEffect(() => {
    if (hasCelebrated.current || !firstNewUnlock || !isMeasured) return;
    hasCelebrated.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setSelectedId(firstNewUnlock);
    fitFocus(firstNewUnlock, DETAIL_CARD_LIFT);
  }, [firstNewUnlock, fitFocus, isMeasured]);

  const selectNode = useCallback(
    (id: SkillTreeNodeId) => {
      showDetailsOf(id);
      if (id === "center") return;
      if (isSkillBranch(id)) fitArea(id, DETAIL_CARD_LIFT);
      else fitFocus(id, DETAIL_CARD_LIFT);
    },
    [fitArea, fitFocus, showDetailsOf],
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
    newlyUnlocked: newlyUnlocked.ids,
    displayedUnlockCount,
    showFirstNewUnlock: firstNewUnlock ? () => showFocus(firstNewUnlock) : null,
  };
}

export type SkillTreeScreenState = ReturnType<typeof useSkillTreeScreen>;
