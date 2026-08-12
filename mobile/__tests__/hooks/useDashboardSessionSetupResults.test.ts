import { act, renderHook } from "@testing-library/react-native";

import { useDashboardSessionSetupResults } from "../../features/dashboard/hooks/useDashboardSessionSetupResults";
import { mockTFunction } from "../helpers/mockTFunction";

function createDependencies() {
  return {
    closeSetupModal: jest.fn(),
    openSetupScreen: jest.fn(),
    loadSessions: jest.fn().mockResolvedValue(undefined),
    loadStreakOverview: jest.fn().mockResolvedValue(undefined),
    setActive: jest.fn(),
    setSessions: jest.fn(),
    setError: jest.fn(),
    t: mockTFunction(),
  };
}

describe("useDashboardSessionSetupResults", () => {
  it("falls back to reloading when a created session is invalid", () => {
    const dependencies = createDependencies();
    const { result } = renderHook(() => useDashboardSessionSetupResults(dependencies));

    act(() => result.current.handleSessionStarted({ id: "invalid" }));

    expect(dependencies.setError).toHaveBeenCalledWith("dashboard.couldNotReadSession");
    const afterClose = dependencies.closeSetupModal.mock.calls[0]?.[0] as (() => void) | undefined;
    afterClose?.();
    expect(dependencies.loadSessions).toHaveBeenCalledTimes(1);
    expect(dependencies.setActive).not.toHaveBeenCalled();
  });

  it("stores a valid session once and refreshes dashboard snapshots after closing", async () => {
    const dependencies = createDependencies();
    const { result } = renderHook(() => useDashboardSessionSetupResults(dependencies));
    const created = { id: 42, started_at: "2026-08-12T10:00:00Z", session_type: "mixing" };

    act(() => result.current.handleSessionStarted(created));

    expect(dependencies.setActive).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    const updateSessions = dependencies.setSessions.mock.calls[0]?.[0] as (
      previous: { id: number }[],
    ) => { id: number }[];
    expect(updateSessions([{ id: 42 }, { id: 7 }])).toEqual([
      expect.objectContaining({ id: 42 }),
      { id: 7 },
    ]);

    const afterClose = dependencies.closeSetupModal.mock.calls[0]?.[0] as () => void;
    afterClose();
    await Promise.resolve();
    expect(dependencies.loadSessions).toHaveBeenCalledTimes(1);
    expect(dependencies.loadStreakOverview).toHaveBeenCalledTimes(1);
  });

  it("keeps crash recovery and active-session conflict paths explicit", () => {
    const dependencies = createDependencies();
    const { result } = renderHook(() => useDashboardSessionSetupResults(dependencies));

    act(() => result.current.recoverFromCrash());
    expect(dependencies.closeSetupModal).toHaveBeenCalledWith(dependencies.openSetupScreen);

    dependencies.closeSetupModal.mockClear();
    act(() => result.current.resolveActiveSessionConflict());
    const afterClose = dependencies.closeSetupModal.mock.calls[0]?.[0] as () => void;
    afterClose();
    expect(dependencies.loadSessions).toHaveBeenCalledTimes(1);
    expect(dependencies.loadStreakOverview).toHaveBeenCalledTimes(1);
  });
});
