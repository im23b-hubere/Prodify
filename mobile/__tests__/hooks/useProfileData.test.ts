import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createClearedProfileState } from "../../features/profile/hooks/profileAuthReset";
import { useProfileData } from "../../features/profile/hooks/useProfileData";
import { apiJson } from "../../lib/client";
import { fetchProgression } from "../../lib/progressionSync";
import { isScreenDataStale } from "../../lib/screenDataStale";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/progressionSync", () => ({
  fetchProgression: jest.fn(),
}));

jest.mock("../../lib/screenDataStale", () => ({
  isScreenDataStale: jest.fn((lastFetchMs: number) => lastFetchMs <= 0),
  SCREEN_DATA_STALE_MS: 45_000,
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockFetchProgression = fetchProgression as jest.MockedFunction<typeof fetchProgression>;
const mockIsScreenDataStale = isScreenDataStale as jest.MockedFunction<typeof isScreenDataStale>;

const userAStats = {
  period: "all",
  summary: {
    total_seconds: 14_400,
    total_sessions: 8,
    avg_session_seconds: 1800,
    current_streak_days: 4,
    best_streak_days: 10,
    hours_delta_vs_prior_period: 2.5,
  },
  trend: [],
  breakdown: [],
  recent_sessions: [],
  productivity_hint: null,
  productivity_hint_item: null,
};

const userAMilestones = {
  milestones: [{ id: "streak_7", title: "7-day streak", unlocked: true }],
  longest_streak_days: 10,
};

const userAReliability = {
  score: 82,
  trend: "up" as const,
  rank_percent: 75,
  consistency_90d: 0.9,
  completion_rate_90d: 0.85,
};

const userAHeatmap = [{ date: "2026-01-01", seconds: 3600, intensity: 2 }];

const userAProgression = {
  xp_total: 250,
  current_level: 3,
  xp_to_next_level: 75,
  progress_percent: 55,
};

const userBStats = {
  period: "all",
  summary: {
    total_seconds: 3600,
    total_sessions: 2,
    avg_session_seconds: 1800,
    current_streak_days: 1,
    best_streak_days: 3,
    hours_delta_vs_prior_period: -1,
  },
  trend: [],
  breakdown: [],
  recent_sessions: [],
  productivity_hint: null,
  productivity_hint_item: null,
};

const userBMilestones = {
  milestones: [{ id: "streak_3", title: "3-day streak", unlocked: true }],
  longest_streak_days: 3,
};

const userBProgression = {
  xp_total: 40,
  current_level: 1,
  xp_to_next_level: 100,
  progress_percent: 15,
};

function mockProfileResponses(options: {
  stats?: unknown;
  milestones?: unknown;
  reliability?: unknown;
  heatmap?: unknown;
  progression?: unknown;
}) {
  mockApiJson.mockImplementation((path: string) => {
    if (path.includes("/sessions/stats")) {
      if (options.stats instanceof Error) return Promise.reject(options.stats);
      return Promise.resolve(options.stats ?? userAStats);
    }
    if (path === "/streak/milestones") {
      if (options.milestones instanceof Error) return Promise.reject(options.milestones);
      return Promise.resolve(options.milestones ?? userAMilestones);
    }
    if (path === "/users/me/reliability") {
      if (options.reliability instanceof Error) return Promise.reject(options.reliability);
      return Promise.resolve(options.reliability ?? userAReliability);
    }
    if (path.includes("/stats/heatmap")) {
      if (options.heatmap instanceof Error) return Promise.reject(options.heatmap);
      return Promise.resolve({ days: options.heatmap ?? userAHeatmap });
    }
    return Promise.resolve(null);
  });
  mockFetchProgression.mockImplementation(() => {
    if (options.progression instanceof Error) return Promise.reject(options.progression);
    return Promise.resolve((options.progression ?? userAProgression) as never);
  });
}

function renderProfileDataHook(token: string | null, userId: number | null) {
  return renderHook(
    ({
      token: hookToken,
      userId: hookUserId,
    }: {
      token: string | null;
      userId: number | null;
    }) => useProfileData(hookToken, hookUserId),
    { initialProps: { token, userId } },
  );
}

async function loadUserAProfile(result: { current: ReturnType<typeof useProfileData> }) {
  await act(async () => {
    await result.current.load();
  });
  await waitFor(() => {
    expect(result.current.stats).toEqual(userAStats);
  });
}

describe("createClearedProfileState", () => {
  it("clears account-owned fields and sets loading false on sign-out", () => {
    expect(createClearedProfileState({ token: null, userId: null })).toEqual({
      refreshing: false,
      loading: false,
      stats: null,
      milestones: null,
      reliability: null,
      heatmapDays: [],
      progression: null,
      error: null,
    });
  });

  it("sets loading true when switching to a signed-in account", () => {
    expect(createClearedProfileState({ token: "token-b", userId: 2 }).loading).toBe(true);
  });
});

describe("useProfileData auth scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsScreenDataStale.mockImplementation((lastFetchMs: number) => lastFetchMs <= 0);
    mockProfileResponses({});
  });

  it("loads Profile data for the signed-in user", async () => {
    const { result } = renderProfileDataHook("token-a", 1);

    await loadUserAProfile(result);

    expect(result.current.milestones).toEqual(userAMilestones);
    expect(result.current.reliability).toEqual(userAReliability);
    expect(result.current.heatmapDays).toEqual(userAHeatmap);
    expect(result.current.progression).toEqual(userAProgression);
    expect(result.current.error).toBeNull();
  });

  it("clears all account-owned Profile state on sign-out", async () => {
    const { result, rerender } = renderProfileDataHook("token-a", 1);

    await loadUserAProfile(result);

    rerender({ token: null, userId: null });

    expect(result.current.stats).toBeNull();
    expect(result.current.milestones).toBeNull();
    expect(result.current.reliability).toBeNull();
    expect(result.current.heatmapDays).toEqual([]);
    expect(result.current.progression).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it("clears user A data before user B loads", async () => {
    const { result, rerender } = renderProfileDataHook("token-a", 1);

    await loadUserAProfile(result);

    mockProfileResponses({
      stats: userBStats,
      milestones: userBMilestones,
      reliability: null,
      heatmap: [],
      progression: userBProgression,
    });
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.stats).toBeNull();
    expect(result.current.milestones).toBeNull();
    expect(result.current.reliability).toBeNull();
    expect(result.current.progression).toBeNull();

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBStats);
    });

    expect(result.current.milestones).toEqual(userBMilestones);
    expect(result.current.progression).toEqual(userBProgression);
  });

  it("does not skip user B load because of user A cache timestamp", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const { result, rerender } = renderProfileDataHook("token-a", 1);

    await loadUserAProfile(result);

    expect(mockApiJson).toHaveBeenCalled();

    mockProfileResponses({
      stats: userBStats,
      milestones: userBMilestones,
      reliability: null,
      heatmap: [],
      progression: userBProgression,
    });
    rerender({ token: "token-b", userId: 2 });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBStats);
    });

    expect(mockApiJson.mock.calls.filter(([path]) => path.includes("/sessions/stats")).length).toBe(
      2,
    );
    nowSpy.mockRestore();
  });

  it("ignores stale user A responses after account switch", async () => {
    let staleResolve: ((value: unknown) => void) | undefined;
    mockApiJson.mockImplementation((path: string) => {
      if (path.includes("/sessions/stats")) {
        return new Promise((resolve) => {
          staleResolve = resolve;
        });
      }
      if (path === "/streak/milestones") return Promise.resolve(userAMilestones);
      if (path === "/users/me/reliability") return Promise.resolve(userAReliability);
      if (path.includes("/stats/heatmap")) return Promise.resolve({ days: userAHeatmap });
      return Promise.resolve(null);
    });

    const { result, rerender } = renderProfileDataHook("token-a", 1);

    mockProfileResponses({
      stats: userBStats,
      milestones: userBMilestones,
      reliability: null,
      heatmap: [],
      progression: userBProgression,
    });
    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(userAStats);
    await Promise.resolve();

    expect(result.current.stats).toBeNull();
    expect(result.current.milestones).toBeNull();

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBStats);
    });
  });

  it("preserves Profile state and cache on same-user token refresh", async () => {
    mockIsScreenDataStale.mockReturnValue(false);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const { result, rerender } = renderProfileDataHook("token-a", 1);

    await act(async () => {
      await result.current.load({ force: true });
    });
    await waitFor(() => {
      expect(result.current.stats).toEqual(userAStats);
    });

    mockApiJson.mockClear();
    mockFetchProgression.mockClear();

    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.stats).toEqual(userAStats);
    expect(result.current.milestones).toEqual(userAMilestones);
    expect(result.current.progression).toEqual(userAProgression);

    await act(async () => {
      await result.current.load();
    });

    expect(mockApiJson).not.toHaveBeenCalled();
    expect(mockFetchProgression).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it("loads normally for a new user after reset", async () => {
    mockProfileResponses({
      stats: userBStats,
      milestones: userBMilestones,
      reliability: null,
      heatmap: [],
      progression: userBProgression,
    });

    const { result } = renderProfileDataHook("token-b", 2);

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.stats).toEqual(userBStats);
    });

    expect(result.current.milestones).toEqual(userBMilestones);
    expect(result.current.error).toBeNull();
  });

  it("preserves same-user cache when data is still fresh", async () => {
    mockIsScreenDataStale.mockReturnValue(false);
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const { result } = renderProfileDataHook("token-a", 1);

    await act(async () => {
      await result.current.load({ force: true });
    });
    await waitFor(() => {
      expect(result.current.stats).toEqual(userAStats);
    });

    mockApiJson.mockClear();
    mockFetchProgression.mockClear();

    await act(async () => {
      await result.current.load();
    });

    expect(mockApiJson).not.toHaveBeenCalled();
    expect(mockFetchProgression).not.toHaveBeenCalled();
    expect(result.current.stats).toEqual(userAStats);
    nowSpy.mockRestore();
  });

  it("preserves milestones on same-user partial stats fetch failure", async () => {
    const { result } = renderProfileDataHook("token-a", 1);

    await loadUserAProfile(result);

    mockProfileResponses({
      stats: new Error("network down"),
      milestones: userAMilestones,
    });

    await act(async () => {
      await result.current.load({ force: true });
    });

    expect(result.current.error).toBe("network down");
    expect(result.current.stats).toBeNull();
    expect(result.current.milestones).toEqual(userAMilestones);
  });
});
