import { PROGRESSION_NAMED_LEVEL_MAX } from "../../lib/progressionLevels";
import { RANK_ART_XML } from "../../lib/rankArt.generated";

describe("rank artwork", () => {
  it("has a 120x120 illustration for every named rank", () => {
    for (let level = 1; level <= PROGRESSION_NAMED_LEVEL_MAX; level += 1) {
      const xml = RANK_ART_XML[level];
      expect(xml).toBeDefined();
      expect(xml).toContain('viewBox="0 0 120 120"');
    }
  });

  it("scopes gradient and clip ids per rank so illustrations never share defs", () => {
    for (let level = 1; level <= PROGRESSION_NAMED_LEVEL_MAX; level += 1) {
      const ids = [...RANK_ART_XML[level]!.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(id!.startsWith(`r${level}`)).toBe(true);
    }
  });
});
