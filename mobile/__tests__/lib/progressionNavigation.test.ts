import {
  parseProgressionOverviewFrom,
  progressionBackLabel,
  progressionOverviewHref,
} from "../../lib/progressionNavigation";

describe("progressionNavigation", () => {
  const t = ((key: string) => key) as Parameters<typeof progressionBackLabel>[0];

  it("builds href with from param", () => {
    expect(progressionOverviewHref("dashboard")).toEqual({
      pathname: "/progression-overview",
      params: { from: "dashboard" },
    });
  });

  it("parses from param with dashboard fallback", () => {
    expect(parseProgressionOverviewFrom("stats")).toBe("stats");
    expect(parseProgressionOverviewFrom(undefined)).toBe("dashboard");
    expect(parseProgressionOverviewFrom(["friends"])).toBe("friends");
  });

  it("maps back labels by origin", () => {
    expect(progressionBackLabel(t, "dashboard")).toBe("progression.backToDashboard");
    expect(progressionBackLabel(t, "stats")).toBe("progression.backToStats");
  });
});
