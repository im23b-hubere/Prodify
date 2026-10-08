import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionType } from "../../../constants/sessionTypes";
import type { SkillFocusId } from "../../../constants/skills";
import { skillFocusText } from "../../../lib/skillI18n";
import type { SkillProgressDto } from "../../../types/skillProgress";
import {
  applyFocusList,
  ensureCredited,
  remainingFocuses,
  setCreditedSeconds,
} from "../creditList";
import { countedMinutes } from "../durationWheel";
import type { FocusReflectionSelection } from "../hooks/useFocusReflectionSelection";
import type { FocusReflection } from "../skillFocusReflection";
import { leveledUpTo } from "../skillProgressPresentation";
import { AddFocusSheet } from "./AddFocusSheet";
import { DurationWheelSheet } from "./DurationWheelSheet";
import { WorkedOnList } from "./WorkedOnList";

type WorkedOnEditorProps = {
  selection: FocusReflectionSelection;
  durationSeconds: number;
  sessionType: SessionType;
  progressBySkill?: Partial<Record<SkillFocusId, SkillProgressDto>>;
  nudge?: boolean;
};

/** Short credited list, Add sheet, and Clock-style duration wheel. */
export function WorkedOnEditor({
  selection,
  durationSeconds,
  sessionType,
  progressBySkill = {},
  nudge = false,
}: WorkedOnEditorProps) {
  const { t } = useTranslation();
  const committed = selection.committedReflection;
  const [addOpen, setAddOpen] = useState(false);
  const [wheelId, setWheelId] = useState<SkillFocusId | null>(null);
  const [preview, setPreview] = useState<FocusReflection | null>(null);
  const shown = ensureCredited(preview ?? committed, durationSeconds);
  const canAdd = remainingFocuses(sessionType, shown.focusIds).length > 0;

  const openWheel = (id: SkillFocusId) => {
    if (committed.focusIds.length < 2) return;
    setWheelId(id);
    setPreview(committed);
  };

  return (
    <>
      <WorkedOnList
        focusIds={shown.focusIds}
        assignedSeconds={shown.assignedSeconds ?? {}}
        leveledToByFocus={Object.fromEntries(
          shown.focusIds.map((id) => [id, leveledUpTo(progressBySkill[id])]),
        )}
        canAdd={canAdd}
        nudge={nudge}
        onRemove={selection.removeFocus}
        onAdd={() => setAddOpen(true)}
        onPressRow={openWheel}
      />
      <AddFocusSheet
        visible={addOpen}
        sessionType={sessionType}
        selectedIds={shown.focusIds}
        onSave={(ids) => {
          const next = applyFocusList(committed, ids, durationSeconds);
          if (next !== committed) selection.commitReflection(next);
        }}
        onClose={() => setAddOpen(false)}
      />
      {wheelId ? (
        <DurationWheelSheet
          visible
          title={skillFocusText(wheelId, "short", t)}
          totalMinutes={Math.round((shown.assignedSeconds?.[wheelId] ?? 0) / 60)}
          maxMinutes={countedMinutes(durationSeconds)}
          onChange={(minutes) => {
            setPreview(setCreditedSeconds(committed, wheelId, minutes * 60, durationSeconds));
          }}
          onSave={() => {
            if (preview) selection.commitReflection(preview);
            setWheelId(null);
            setPreview(null);
          }}
          onCancel={() => {
            setWheelId(null);
            setPreview(null);
          }}
        />
      ) : null}
    </>
  );
}
