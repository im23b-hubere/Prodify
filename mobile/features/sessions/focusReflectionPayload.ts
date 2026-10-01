import type { SessionType } from "../../constants/sessionTypes";
import { areaWeightsPayload } from "./areaWeights";
import type { FocusReflection } from "./skillFocusReflection";

/** The PATCH fields that store a session's reflection; only production sessions weigh areas. */
export function focusReflectionPayload(reflection: FocusReflection, sessionType: SessionType) {
  const focusFields = {
    skill_focus_ids: reflection.focusIds,
    primary_skill_focus_id: reflection.primaryFocusId,
  };
  if (sessionType !== "production") return focusFields;
  return { ...focusFields, area_weights: areaWeightsPayload(reflection) };
}
