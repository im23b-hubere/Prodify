import { act, renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { useDashboardSessionActions } from "../../features/dashboard/hooks/useDashboardSessionActions";
import type { SessionDto } from "../../types/session";

const mockPush = jest.fn();
const mockT = ((key: string) => key) as TFunction;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error", Warning: "Warning" },
}));

function createOptions(
  overrides: Partial<Parameters<typeof useDashboardSessionActions>[0]> = {},
) {
  return {
    token: "token",
    active: null,
    activeResolved: true,
    suggestedSessionType: "beat_making",
    displayOverview: null,
    t: mockT,
    setActive: jest.fn(),
    setError: jest.fn(),
    setRefreshing: jest.fn(),
    loadSessions: jest.fn().mockResolvedValue(undefined),
    loadStreakOverview: jest.fn().mockResolvedValue(undefined),
    refreshDashboard: jest.fn().mockResolvedValue(undefined),
    invalidateDashboard: jest.fn(),
    ...overrides,
  };
}

describe("useDashboardSessionActions openSessionSetup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not open setup while active session state is unresolved", () => {
    const { result } = renderHook(() =>
      useDashboardSessionActions(createOptions({ activeResolved: false })),
    );

    act(() => {
      result.current.openSessionSetup();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens setup when active session is resolved and none is running", () => {
    const options = createOptions({ activeResolved: true, active: null });
    const { result } = renderHook(() => useDashboardSessionActions(options));

    act(() => {
      result.current.openSessionSetup();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/session/setup",
      params: { suggestedType: "beat_making", source: "dashboard" },
    });
    expect(options.invalidateDashboard).toHaveBeenCalledTimes(1);
  });

  it("blocks setup when an active session exists", () => {
    const { result } = renderHook(() =>
      useDashboardSessionActions(
        createOptions({
          activeResolved: true,
          active: {
            id: 7,
            user_id: 1,
            started_at: "2026-08-31T10:00:00.000Z",
            stopped_at: null,
            duration_seconds: 120,
            session_type: "beat_making",
            notes: null,
          } satisfies SessionDto,
        }),
      ),
    );

    act(() => {
      result.current.openSessionSetup();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("blocks setup after a failed active-session fetch", () => {
    const { result } = renderHook(() =>
      useDashboardSessionActions(createOptions({ activeResolved: false, active: null })),
    );

    act(() => {
      result.current.openSessionSetup();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
