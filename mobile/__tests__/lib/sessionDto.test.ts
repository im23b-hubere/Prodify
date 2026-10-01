import { tryParseSessionDto } from "../../lib/sessionDto";

const baseSession = { id: 1, started_at: "2026-09-30T10:00:00Z", session_type: "mixing" };

describe("tryParseSessionDto skill focuses", () => {
  it("keeps known skill focus ids in order", () => {
    const session = tryParseSessionDto({
      ...baseSession,
      skill_focus_ids: ["mixing.dynamics", "mixing.eq"],
    });

    expect(session?.skill_focus_ids).toEqual(["mixing.dynamics", "mixing.eq"]);
  });

  it("drops ids this app version does not know", () => {
    const session = tryParseSessionDto({
      ...baseSession,
      skill_focus_ids: ["mixing.eq", "mixing.future_skill", 42],
    });

    expect(session?.skill_focus_ids).toEqual(["mixing.eq"]);
  });

  it("defaults to an empty list when the field is missing", () => {
    expect(tryParseSessionDto(baseSession)?.skill_focus_ids).toEqual([]);
  });
});

describe("tryParseSessionDto area weights", () => {
  it("keeps the weights of known areas", () => {
    const session = tryParseSessionDto({
      ...baseSession,
      session_type: "production",
      area_weights: [{ branch: "mixing", weight: 3 }],
    });

    expect(session?.area_weights).toEqual([{ branch: "mixing", weight: 3 }]);
  });

  it("drops unknown areas and weights outside a little to a lot", () => {
    const session = tryParseSessionDto({
      ...baseSession,
      session_type: "production",
      area_weights: [
        { branch: "mixing", weight: 4 },
        { branch: "future_area", weight: 2 },
        { branch: "recording", weight: 1 },
      ],
    });

    expect(session?.area_weights).toEqual([{ branch: "recording", weight: 1 }]);
  });
});
