import { tryParseSkillProfile } from "../../lib/skillProfileDto";

const nodeFields = {
  total_seconds: 7200,
  level: 2,
  level_start_seconds: 3600,
  next_level_seconds: 10800,
  session_count: 3,
  last_trained_at: "2026-09-29T10:00:00Z",
};

describe("tryParseSkillProfile", () => {
  it("parses branches and focuses", () => {
    const profile = tryParseSkillProfile({
      total_seconds: 7200,
      branches: [{ branch: "mixing", ...nodeFields }],
      focuses: [{ skill_id: "mixing.eq", branch: "mixing", ...nodeFields }],
    });

    expect(profile?.branches[0]).toEqual({ branch: "mixing", ...nodeFields });
    expect(profile?.focuses[0].skill_id).toBe("mixing.eq");
  });

  it("skips skills this app version does not know", () => {
    const profile = tryParseSkillProfile({
      total_seconds: 0,
      branches: [{ branch: "dj_sets", ...nodeFields }],
      focuses: [{ skill_id: "mixing.future", branch: "mixing", ...nodeFields }],
    });

    expect(profile).toEqual({ total_seconds: 0, branches: [], focuses: [] });
  });

  it("treats a missing next level as the top level", () => {
    const profile = tryParseSkillProfile({
      total_seconds: 1,
      branches: [{ branch: "mixing", ...nodeFields, next_level_seconds: null }],
      focuses: [],
    });

    expect(profile?.branches[0].next_level_seconds).toBeNull();
  });

  it("rejects payloads that are not a profile", () => {
    expect(tryParseSkillProfile(null)).toBeNull();
    expect(tryParseSkillProfile({ branches: [] })).toBeNull();
  });
});
