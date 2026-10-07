import { addCreditedFocus } from "../../../features/sessions/creditList";
import { focusReflectionPayload } from "../../../features/sessions/focusReflectionPayload";
import type { FocusReflection } from "../../../features/sessions/skillFocusReflection";

const NINETY_TWO_MIN = 92 * 60;
const reflection: FocusReflection = {
  focusIds: ["mixing.eq"],
  primaryFocusId: "mixing.eq",
  areaWeights: { beat_making: 3 },
};
const empty: FocusReflection = { focusIds: [], primaryFocusId: null, areaWeights: {} };

describe("focusReflectionPayload", () => {
  it("sends the area weights of a production session", () => {
    expect(focusReflectionPayload(reflection, "production")).toEqual({
      skill_focus_ids: ["mixing.eq"],
      primary_skill_focus_id: "mixing.eq",
      area_weights: [
        { branch: "beat_making", weight: 3 },
        { branch: "mixing", weight: 2 },
      ],
    });
  });

  it("never sends area weights for other session types", () => {
    expect(focusReflectionPayload(reflection, "mixing")).not.toHaveProperty("area_weights");
  });

  it("omits focus times when the list is empty", () => {
    expect(focusReflectionPayload(empty, "mixing")).toEqual({
      skill_focus_ids: [],
      primary_skill_focus_id: null,
    });
  });

  it("sends a full split and no area weights once minutes are credited", () => {
    const credited = addCreditedFocus(
      addCreditedFocus(empty, "mixing.stereo", NINETY_TWO_MIN),
      "mixing.eq",
      NINETY_TWO_MIN,
    );

    expect(focusReflectionPayload(credited, "production")).toEqual({
      skill_focus_ids: ["mixing.stereo", "mixing.eq"],
      focus_times: [
        { skill_id: "mixing.stereo", assigned_seconds: 46 * 60 },
        { skill_id: "mixing.eq", assigned_seconds: 46 * 60 },
      ],
    });
  });
});
