import { apiJson } from "../../../lib/client";
import { fetchPrimaryStats } from "../../../features/stats/statsScreenDataService";

jest.mock("../../../lib/client", () => ({
  apiJson: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

describe("fetchPrimaryStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns stats when heatmap and records fail independently", async () => {
    mockApiJson.mockImplementation(async (path: string) => {
      if (path.includes("/sessions/stats")) {
        return {
          period: "week",
          summary: {
            total_seconds: 0,
            total_sessions: 0,
            avg_session_seconds: 0,
            current_streak_days: 0,
            best_streak_days: 0,
            hours_delta_vs_prior_period: 0,
          },
          trend: [],
          breakdown: [],
          recent_sessions: [],
        };
      }
      if (path.includes("/stats/heatmap")) throw new Error("heatmap down");
      if (path.includes("/stats/records")) throw new Error("records down");
      return null;
    });

    const result = await fetchPrimaryStats("token", "week");

    expect(result.stats?.summary.total_sessions).toBe(0);
    expect(result.heatmapDays).toBeUndefined();
    expect(result.records).toBeUndefined();
  });

  it("throws when the primary stats request fails", async () => {
    mockApiJson.mockImplementation(async (path: string) => {
      if (path.includes("/sessions/stats")) throw new Error("stats down");
      return { days: [] };
    });

    await expect(fetchPrimaryStats("token", "week")).rejects.toThrow("stats down");
  });
});
