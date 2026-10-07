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

describe("tryParseSessionDto focus times", () => {
  it("keeps known assigned seconds in order", () => {
    const session = tryParseSessionDto({
      ...baseSession,
      skill_focus_ids: ["mixing.stereo", "mixing.eq"],
      focus_times: [
        { skill_id: "mixing.stereo", assigned_seconds: 2760 },
        { skill_id: "mixing.eq", assigned_seconds: 2760 },
      ],
    });

    expect(session?.focus_times).toEqual([
      { skill_id: "mixing.stereo", assigned_seconds: 2760 },
      { skill_id: "mixing.eq", assigned_seconds: 2760 },
    ]);
  });

  it("drops unknown ids, negatives, and junk", () => {
    const session = tryParseSessionDto({
      ...baseSession,
      focus_times: [
        { skill_id: "mixing.eq", assigned_seconds: 60 },
        { skill_id: "mixing.future_skill", assigned_seconds: 60 },
        { skill_id: "mixing.space", assigned_seconds: -1 },
        { skill_id: "mixing.stereo" },
        42,
      ],
    });

    expect(session?.focus_times).toEqual([{ skill_id: "mixing.eq", assigned_seconds: 60 }]);
  });

  it("defaults to an empty list when the field is missing", () => {
    expect(tryParseSessionDto(baseSession)?.focus_times).toEqual([]);
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
