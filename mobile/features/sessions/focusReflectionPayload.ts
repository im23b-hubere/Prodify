import type { SessionType } from "../../constants/sessionTypes";
import { areaWeightsPayload } from "./areaWeights";
import type { FocusReflection } from "./skillFocusReflection";

/** The PATCH fields that store a session's reflection; only production sessions weigh areas. */
export function focusReflectionPayload(reflection: FocusReflection, sessionType: SessionType) {
  const focusTimes = focusTimesPayload(reflection);
  if (focusTimes) {
    return { skill_focus_ids: reflection.focusIds, focus_times: focusTimes };
  }
  const focusFields = {
    skill_focus_ids: reflection.focusIds,
    primary_skill_focus_id: reflection.primaryFocusId,
  };
  if (sessionType !== "production") return focusFields;
  return { ...focusFields, area_weights: areaWeightsPayload(reflection) };
}

function focusTimesPayload(reflection: FocusReflection) {
  const assigned = reflection.assignedSeconds ?? {};
  if (reflection.focusIds.length === 0 || Object.keys(assigned).length === 0) return null;
  return reflection.focusIds.map((skill_id) => ({
    skill_id,
    assigned_seconds: assigned[skill_id] ?? 0,
  }));
}
