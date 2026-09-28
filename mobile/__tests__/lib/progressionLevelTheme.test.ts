import { levelTierFor } from "../../lib/progressionLevelTheme";

describe("progressionLevelTheme", () => {
  it("maps levels to five tiers", () => {
    expect(levelTierFor(1).id).toBe("starter");
    expect(levelTierFor(4).id).toBe("starter");
    expect(levelTierFor(5).id).toBe("builder");
    expect(levelTierFor(20).id).toBe("legend");
  });
});
