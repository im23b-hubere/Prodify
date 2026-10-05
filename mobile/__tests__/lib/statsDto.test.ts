import { tryParseSessionStatsDto } from "../../lib/statsDto";

describe("tryParseSessionStatsDto branch seconds", () => {
  it("keeps period branch hours from the skill-tree split", () => {
    const stats = tryParseSessionStatsDto({
      period: "week",
      summary: {},
      branch_seconds: [
        { branch: "mixing", seconds: 3600 },
        { branch: "beat_making", seconds: 1800 },
      ],
    });

    expect(stats?.branch_seconds).toEqual([
      { branch: "mixing", seconds: 3600 },
      { branch: "beat_making", seconds: 1800 },
    ]);
  });

  it("drops empty branches and defaults a missing list", () => {
    const parsed = tryParseSessionStatsDto({
      period: "week",
      summary: {},
      branch_seconds: [
        { branch: "", seconds: 1200 },
        { branch: "mixing", seconds: 0 },
        { branch: "recording", seconds: -8 },
        { seconds: 400 },
      ],
    });

    expect(parsed?.branch_seconds).toEqual([]);
    expect(tryParseSessionStatsDto({ period: "week", summary: {} })?.branch_seconds).toEqual([]);
  });
});
