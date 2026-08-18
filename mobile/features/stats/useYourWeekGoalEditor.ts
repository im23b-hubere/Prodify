import { useState } from "react";

import type { CommitmentDto } from "../../types/friends";
import type { GoalCurrentDto } from "../../types/goals";
import { resolveGoalTarget } from "./yourWeekPresentation";

export const WEEKLY_GOAL_CHIPS = [3, 5, 7] as const;

type GoalEditorOptions = {
  goal: GoalCurrentDto | null;
  commitment: CommitmentDto | null;
  onSaveGoal: (target: number, shareWithFriends: boolean) => Promise<void>;
};

export function useYourWeekGoalEditor({ goal, commitment, onSaveGoal }: GoalEditorOptions) {
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(5);
  const [customTarget, setCustomTarget] = useState("");
  const [shareWithFriends, setShareWithFriends] = useState(false);

  const openEditor = (prefill?: number) => {
    const value = prefill ?? goal?.target_value ?? 5;
    setSelectedTarget(value);
    setCustomTarget(
      WEEKLY_GOAL_CHIPS.includes(value as (typeof WEEKLY_GOAL_CHIPS)[number]) ? "" : String(value),
    );
    setShareWithFriends(Boolean(commitment));
    setOpen(true);
  };

  const selectPreset = (target: number) => {
    setSelectedTarget(target);
    setCustomTarget("");
  };

  const save = async () => {
    const target = resolveGoalTarget(customTarget, selectedTarget);
    if (target == null) return;
    await onSaveGoal(target, shareWithFriends);
    setOpen(false);
  };

  return {
    open,
    close: () => setOpen(false),
    openEditor,
    selectedTarget,
    customTarget,
    setCustomTarget,
    selectPreset,
    shareWithFriends,
    setShareWithFriends,
    save,
  };
}

export type YourWeekGoalEditorState = ReturnType<typeof useYourWeekGoalEditor>;
