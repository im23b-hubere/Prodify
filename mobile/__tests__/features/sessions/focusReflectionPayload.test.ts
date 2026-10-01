import { focusReflectionPayload } from "../../../features/sessions/focusReflectionPayload";
import type { FocusReflection } from "../../../features/sessions/skillFocusReflection";

const reflection: FocusReflection = {
  focusIds: ["mixing.eq"],
  primaryFocusId: "mixing.eq",
  areaWeights: { beat_making: 3 },
};

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
});
