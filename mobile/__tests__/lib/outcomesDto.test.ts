import { tryParseProgressionDto } from "../../lib/outcomesDto";

describe("tryParseProgressionDto", () => {
  it("parses genuine Level 1 / 0 XP progression", () => {
    expect(
      tryParseProgressionDto({
        current_level: 1,
        xp_total: 0,
        xp_to_next_level: 50,
        progress_percent: 0,
      }),
    ).toEqual({
      current_level: 1,
      xp_total: 0,
      xp_to_next_level: 50,
      progress_percent: 0,
      decay_grace_days: 2,
      decay_xp_per_day: 12,
    });
  });

  it("parses higher-level progression unchanged", () => {
    expect(
      tryParseProgressionDto({
        current_level: 8,
        xp_total: 1200,
        xp_to_next_level: 90,
        progress_percent: 55,
        decay_grace_days: 3,
        decay_xp_per_day: 10,
      }),
    ).toEqual({
      current_level: 8,
      xp_total: 1200,
      xp_to_next_level: 90,
      progress_percent: 55,
      decay_grace_days: 3,
      decay_xp_per_day: 10,
    });
  });

  it("returns null for missing progression payload", () => {
    expect(tryParseProgressionDto(null)).toBeNull();
    expect(tryParseProgressionDto(undefined)).toBeNull();
    expect(tryParseProgressionDto({})).toBeNull();
  });

  it("returns null for partial progression payload without fabricated defaults", () => {
    expect(tryParseProgressionDto({ current_level: 1 })).toBeNull();
    expect(tryParseProgressionDto({ xp_total: 0 })).toBeNull();
    expect(
      tryParseProgressionDto({
        current_level: 1,
        xp_total: 0,
        progress_percent: 0,
      }),
    ).toBeNull();
  });

  it("returns null for malformed numeric progression fields", () => {
    expect(
      tryParseProgressionDto({
        current_level: "bad",
        xp_total: 0,
        xp_to_next_level: 50,
        progress_percent: 0,
      }),
    ).toBeNull();
    expect(
      tryParseProgressionDto({
        current_level: 0,
        xp_total: 0,
        xp_to_next_level: 50,
        progress_percent: 0,
      }),
    ).toBeNull();
  });
});
