import { groupLevelsByTier, levelRankState, levelTierFor } from "../../lib/progressionLevelTheme";

describe("progressionLevelTheme", () => {
  it("maps levels to five tiers", () => {
    expect(levelTierFor(1).id).toBe("starter");
    expect(levelTierFor(4).id).toBe("starter");
    expect(levelTierFor(5).id).toBe("builder");
    expect(levelTierFor(20).id).toBe("legend");
  });

  it("derives rank state from current level", () => {
    expect(levelRankState(3, 8)).toBe("unlocked");
    expect(levelRankState(8, 8)).toBe("current");
    expect(levelRankState(12, 8)).toBe("locked");
  });

  it("groups catalog entries by tier", () => {
    const groups = groupLevelsByTier([{ level: 1 }, { level: 5 }, { level: 9 }] as Array<{
      level: number;
    }>);
    expect(groups).toHaveLength(3);
    expect(groups[0]?.tier.id).toBe("starter");
    expect(groups[1]?.tier.id).toBe("builder");
  });
});
