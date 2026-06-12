import { progressionLevelName } from "../../lib/progressionLevels";

describe("progressionLevelName", () => {
  const t = ((key: string, opts?: { defaultValue?: string }) => {
    if (key === "progression.levelNames.1") return "Bedroom Producer";
    if (key === "progression.levelNames.8") return "DAW Demon";
    if (key === "progression.levelNameFallback") {
      return `Level ${(opts as { level?: number })?.level ?? "?"}`;
    }
    return opts?.defaultValue ?? key;
  }) as Parameters<typeof progressionLevelName>[0];

  it("returns named rank for known levels", () => {
    expect(progressionLevelName(t, 1)).toBe("Bedroom Producer");
    expect(progressionLevelName(t, 8)).toBe("DAW Demon");
  });

  it("falls back for unknown levels", () => {
    expect(progressionLevelName(t, 99)).toBe("Level 99");
  });
});
