import { act, renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { useDashboardSessionActions } from "../../features/dashboard/hooks/useDashboardSessionActions";
import { resumeActiveSession } from "../../features/sessions/services/activeSessionApi";
import { ApiError } from "../../lib/apiErrors";
import { resetSessionPresenceStateForTests } from "../../lib/sessionPresence";
import type { SessionDto } from "../../types/session";

const mockPush = jest.fn();
const mockT = ((key: string) => key) as TFunction;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
  NotificationFeedbackType: { Success: "Success", Error: "Error", Warning: "Warning" },
}));

jest.mock("../../lib/sessionPresenceNotifications", () => ({
  syncSessionPresenceNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../features/sessions/services/activeSessionApi", () => ({
  resumeActiveSession: jest.fn(),
}));

function createOptions(overrides: Partial<Parameters<typeof useDashboardSessionActions>[0]> = {}) {
  return {
    token: "token",
    active: null,
    activeResolved: true,
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
    resetSessionPresenceStateForTests();
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

  it("opens setup with nothing preselected when no session is running", () => {
    const options = createOptions({ activeResolved: true, active: null });
    const { result } = renderHook(() => useDashboardSessionActions(options));

    act(() => {
      result.current.openSessionSetup();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/session/setup",
      params: { source: "dashboard" },
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
            started_at: new Date(Date.now() - 120_000).toISOString(),
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

function pausedSession(): SessionDto {
  const now = Date.now();
  return {
    id: 9,
    user_id: 1,
    started_at: new Date(now - 60 * 60 * 1000).toISOString(),
    stopped_at: null,
    duration_seconds: null,
    session_type: "beat_making",
    notes: null,
    pause_started_at: new Date(now - 30 * 60 * 1000).toISOString(),
    paused_duration_seconds: 0,
  };
}

describe("useDashboardSessionActions resumePaused", () => {
  beforeEach(() => {
    resetSessionPresenceStateForTests();
    jest.clearAllMocks();
  });

  it("keeps the dashboard paused until the server confirms the resume", async () => {
    const active = pausedSession();
    const options = createOptions({ active });
    const resumed = { ...active, pause_started_at: null };
    jest.mocked(resumeActiveSession).mockImplementation(async () => {
      expect(options.setActive).not.toHaveBeenCalled();
      return resumed;
    });
    const { result } = renderHook(() => useDashboardSessionActions(options));

    await act(async () => {
      await result.current.resumePaused();
    });

    expect(options.setActive).toHaveBeenCalledWith(resumed);
    expect(options.loadSessions).not.toHaveBeenCalled();
  });

  it("reloads when the paused session was already stopped", async () => {
    const options = createOptions({ active: pausedSession() });
    jest
      .mocked(resumeActiveSession)
      .mockRejectedValue(new ApiError(400, "Session already stopped"));
    const { result } = renderHook(() => useDashboardSessionActions(options));

    await act(async () => {
      await result.current.resumePaused();
    });

    expect(options.setActive).not.toHaveBeenCalled();
    expect(options.setError).not.toHaveBeenCalled();
    expect(options.loadSessions).toHaveBeenCalledTimes(1);
  });
});
