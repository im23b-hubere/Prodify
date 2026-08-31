import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createClearedStatsScreenState } from "../../features/stats/hooks/statsAuthReset";
import { useStatsScreenData } from "../../features/stats/hooks/useStatsScreenData";
import {
  fetchPrimaryStats,
  fetchSupplementalStats,
} from "../../features/stats/statsScreenDataService";
import { isScreenDataStale } from "../../lib/screenDataStale";
import { mockTFunction } from "../helpers/mockTFunction";

jest.mock("../../features/stats/statsScreenDataService", () => ({
  fetchPrimaryStats: jest.fn(),
  fetchSupplementalStats: jest.fn(),
}));

jest.mock("../../lib/screenDataStale", () => ({
  isScreenDataStale: jest.fn(() => true),
  SCREEN_DATA_STALE_MS: 45_000,
}));

const mockFetchPrimaryStats = fetchPrimaryStats as jest.MockedFunction<typeof fetchPrimaryStats>;
const mockFetchSupplementalStats = fetchSupplementalStats as jest.MockedFunction<
  typeof fetchSupplementalStats
>;
const mockIsScreenDataStale = isScreenDataStale as jest.MockedFunction<typeof isScreenDataStale>;

const t = mockTFunction();

const userAPrimary = {
  stats: {
    period: "week",
    summary: {
      total_seconds: 7200,
      total_sessions: 4,
      avg_session_seconds: 1800,
      current_streak_days: 2,
      best_streak_days: 5,
      hours_delta_vs_prior_period: 1.2,
    },
    trend: [],
    breakdown: [],
    recent_sessions: [],
    productivity_hint: null,
  },
  heatmapDays: [{ date: "2026-01-01", seconds: 3600, intensity: 2 }],
  records: [
    {
      key: "longest_session",
      label: "Longest session",
      value: "1h 30m",
      context: null,
      occurred_at: "2026-01-01T10:00:00Z",
    },
  ],
};

const userASupplemental = {
  progression: {
    xp_total: 100,
    current_level: 2,
    xp_to_next_level: 50,
    progress_percent: 40,
  },
  weeklyGoal: {
    goal_type: "weekly_sessions" as const,
    target_value: 5,
    week_start: "2026-06-23",
    current_sessions: 2,
    progress_percent: 40,
  },
  commitment: {
    week_start: "2026-06-23",
    target_sessions: 5,
    current_sessions: 2,
    status: "on_track" as const,
    visibility: "friends" as const,
  },
  goalConfigured: true,
  forecast: {
    week_start: "2026-06-23",
    target_sessions: 5,
    completed_sessions: 2,
    remaining_sessions: 3,
    days_left: 4,
    required_sessions_per_day: 1,
    risk_level: "at_risk" as const,
    warning_message: "Catch up",
  },
};

const userBPrimary = {
  stats: {
    period: "week",
    summary: {
      total_seconds: 3600,
      total_sessions: 2,
      avg_session_seconds: 1800,
      current_streak_days: 1,
      best_streak_days: 3,
      hours_delta_vs_prior_period: -0.5,
    },
    trend: [],
    breakdown: [],
    recent_sessions: [],
    productivity_hint: null,
  },
  heatmapDays: [{ date: "2026-01-02", seconds: 1800, intensity: 1 }],
  records: [
    {
      key: "longest_session",
      label: "Longest session",
      value: "45m",
      context: null,
      occurred_at: "2026-01-02T10:00:00Z",
    },
  ],
};

const userBSupplemental = {
  progression: {
    xp_total: 50,
    current_level: 1,
    xp_to_next_level: 100,
    progress_percent: 10,
  },
  weeklyGoal: null,
  commitment: null,
  goalConfigured: false,
  forecast: null,
};

function renderStatsDataHook(token: string | null, userId: number | null) {
  return renderHook(
    ({
      token: hookToken,
      userId: hookUserId,
    }: {
      token: string | null;
      userId: number | null;
    }) => useStatsScreenData(hookToken, hookUserId, "week", t),
    { initialProps: { token, userId } },
  );
}

async function loadUserAStats(result: { current: ReturnType<typeof useStatsScreenData> }) {
  await act(async () => {
    await result.current.loadStats();
  });
  await waitFor(() => {
    expect(result.current.stats).toEqual(userAPrimary.stats);
  });
}

describe("createClearedStatsScreenState", () => {
  it("clears account-owned fields and sets loading false on sign-out", () => {
    expect(createClearedStatsScreenState({ token: null, userId: null })).toEqual({
      refreshing: false,
      loading: false,
      stats: null,
      heatmapDays: [],
      records: [],
      error: null,
      forecast: null,
      weeklyGoal: null,
      commitment: null,
      goalConfigured: false,
      weekBusy: false,
      progression: null,
      progressionSettled: false,
    });
  });

  it("sets loading true when switching to a signed-in account", () => {
    expect(createClearedStatsScreenState({ token: "token-b", userId: 2 }).loading).toBe(true);
    expect(createClearedStatsScreenState({ token: "token-b", userId: 2 }).progressionSettled).toBe(
      false,
    );
  });
});

describe("useStatsScreenData auth scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsScreenDataStale.mockReturnValue(true);
    mockFetchPrimaryStats.mockResolvedValue(userAPrimary as never);
    mockFetchSupplementalStats.mockResolvedValue(userASupplemental as never);
  });

  it("loads Stats data for the signed-in user", async () => {
    const { result } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    expect(result.current.heatmapDays).toEqual(userAPrimary.heatmapDays);
    expect(result.current.records).toEqual(userAPrimary.records);
    expect(result.current.progression).toEqual(userASupplemental.progression);
    expect(result.current.weeklyGoal).toEqual(userASupplemental.weeklyGoal);
    expect(result.current.commitment).toEqual(userASupplemental.commitment);
    expect(result.current.forecast).toEqual(userASupplemental.forecast);
    expect(result.current.error).toBeNull();
  });

  it("clears account-owned Stats state on sign-out", async () => {
    const { result, rerender } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    rerender({ token: null, userId: null });

    expect(result.current.stats).toBeNull();
    expect(result.current.heatmapDays).toEqual([]);
    expect(result.current.records).toEqual([]);
    expect(result.current.progression).toBeNull();
    expect(result.current.weeklyGoal).toBeNull();
    expect(result.current.commitment).toBeNull();
    expect(result.current.forecast).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it("clears user A data before user B loads", async () => {
    const { result, rerender } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    mockFetchPrimaryStats.mockResolvedValue(userBPrimary as never);
    mockFetchSupplementalStats.mockResolvedValue(userBSupplemental as never);
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.stats).toBeNull();
    expect(result.current.progression).toBeNull();
    expect(result.current.weeklyGoal).toBeNull();
    expect(result.current.records).toEqual([]);

    await act(async () => {
      await result.current.loadStats();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBPrimary.stats);
    });

    expect(result.current.progression).toEqual(userBSupplemental.progression);
  });

  it("does not skip user B load because of user A cache timestamp", async () => {
    mockIsScreenDataStale.mockReturnValue(false);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const { result, rerender } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    expect(mockFetchPrimaryStats).toHaveBeenCalledTimes(1);

    mockFetchPrimaryStats.mockResolvedValue(userBPrimary as never);
    mockFetchSupplementalStats.mockResolvedValue(userBSupplemental as never);
    rerender({ token: "token-b", userId: 2 });

    await act(async () => {
      await result.current.loadStats();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBPrimary.stats);
    });

    expect(mockFetchPrimaryStats).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("ignores stale user A responses after account switch", async () => {
    let staleResolve: ((value: Awaited<ReturnType<typeof fetchPrimaryStats>>) => void) | undefined;
    mockFetchPrimaryStats.mockImplementation(
      () =>
        new Promise((resolve) => {
          staleResolve = resolve;
        }),
    );

    const { result, rerender } = renderStatsDataHook("token-a", 1);

    mockFetchPrimaryStats.mockResolvedValue(userBPrimary as never);
    mockFetchSupplementalStats.mockResolvedValue(userBSupplemental as never);
    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(userAPrimary as Awaited<ReturnType<typeof fetchPrimaryStats>>);
    await Promise.resolve();

    expect(result.current.stats).toBeNull();
    expect(result.current.progression).toBeNull();

    await act(async () => {
      await result.current.loadStats();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBPrimary.stats);
    });
  });

  it("preserves Stats state and cache on same-user token refresh", async () => {
    mockIsScreenDataStale.mockReturnValue(false);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const { result, rerender } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    mockFetchPrimaryStats.mockClear();
    mockFetchSupplementalStats.mockClear();

    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.stats).toEqual(userAPrimary.stats);
    expect(result.current.progression).toEqual(userASupplemental.progression);
    expect(result.current.weeklyGoal).toEqual(userASupplemental.weeklyGoal);

    await act(async () => {
      await result.current.loadStats();
    });

    expect(mockFetchPrimaryStats).not.toHaveBeenCalled();
    expect(mockFetchSupplementalStats).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it("loads normally for a new user after reset", async () => {
    mockFetchPrimaryStats.mockResolvedValue(userBPrimary as never);
    mockFetchSupplementalStats.mockResolvedValue(userBSupplemental as never);

    const { result } = renderStatsDataHook("token-b", 2);

    await act(async () => {
      await result.current.loadStats();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBPrimary.stats);
    });

    expect(result.current.progression).toEqual(userBSupplemental.progression);
    expect(result.current.error).toBeNull();
  });

  it("preserves same-user cache when data is still fresh", async () => {
    mockIsScreenDataStale.mockReturnValue(false);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const { result } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    mockFetchPrimaryStats.mockClear();
    mockFetchSupplementalStats.mockClear();

    await act(async () => {
      await result.current.loadStats();
    });

    expect(mockFetchPrimaryStats).not.toHaveBeenCalled();
    expect(mockFetchSupplementalStats).not.toHaveBeenCalled();
    expect(result.current.stats).toEqual(userAPrimary.stats);
    nowSpy.mockRestore();
  });

  it("preserves stats on same-user transient fetch failure", async () => {
    const { result } = renderStatsDataHook("token-a", 1);

    await loadUserAStats(result);

    mockFetchPrimaryStats.mockReset();
    mockFetchPrimaryStats.mockRejectedValue(new Error("network down"));

    await act(async () => {
      await result.current.loadStats({ force: true });
    });

    expect(result.current.error).toBe("network down");
    expect(result.current.stats).toEqual(userAPrimary.stats);
  });
});
