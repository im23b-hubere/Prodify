import {
  parseProgressionOverviewFrom,
  progressionOverviewHref,
} from "../../lib/progressionNavigation";

describe("progressionNavigation", () => {
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
});
