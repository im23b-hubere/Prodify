import { act, renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { useDashboardSessionsData } from "../../features/dashboard/hooks/useDashboardSessionsData";
import { apiJson } from "../../lib/client";
import { parseSessionList, tryParseSessionDto } from "../../lib/sessionDto";

const mockT = ((key: string) => key) as TFunction;

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/sessionDto", () => ({
  parseSessionList: jest.fn(() => []),
  tryParseSessionDto: jest.fn(() => null),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockParseSessionList = parseSessionList as jest.MockedFunction<typeof parseSessionList>;
const mockTryParseSessionDto = tryParseSessionDto as jest.MockedFunction<typeof tryParseSessionDto>;

describe("useDashboardSessionsData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation(async (path: string) => {
      if (path === "/sessions/list?limit=200") return [];
      if (path === "/sessions/active") return null;
      return null;
    });
    mockParseSessionList.mockReturnValue([]);
    mockTryParseSessionDto.mockReturnValue(null);
  });

  it("keeps active unresolved until the first session fetch completes", async () => {
    let resolveList: (value: unknown) => void = () => undefined;
    mockApiJson.mockImplementation(
      (path) =>
        new Promise((resolve) => {
          if (path === "/sessions/list?limit=200") {
            resolveList = resolve;
            return;
          }
          resolve(null);
        }),
    );

    const { result } = renderHook(() => useDashboardSessionsData("token", mockT));

    expect(result.current.activeResolved).toBe(false);
    expect(result.current.active).toBeNull();

    let loadPromise: Promise<void>;
    act(() => {
      loadPromise = result.current.loadSessions();
    });

    await act(async () => {
      resolveList([]);
      await loadPromise;
    });

    expect(result.current.activeResolved).toBe(true);
    expect(result.current.active).toBeNull();
  });

  it("marks active resolved with no active session after a successful load", async () => {
    const { result } = renderHook(() => useDashboardSessionsData("token", mockT));

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.activeResolved).toBe(true);
    expect(result.current.active).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("marks active resolved when an active session is returned", async () => {
    const activeSession = {
      id: 42,
      started_at: "2026-08-31T10:00:00.000Z",
      stopped_at: null,
      session_type: "beat_making",
    };
    mockParseSessionList.mockReturnValue([activeSession as never]);

    const { result } = renderHook(() => useDashboardSessionsData("token", mockT));

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.activeResolved).toBe(true);
    expect(result.current.active).toEqual(activeSession);
  });

  it("does not mark active resolved when the session list request fails", async () => {
    mockApiJson.mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useDashboardSessionsData("token", mockT));

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.activeResolved).toBe(false);
    expect(result.current.active).toBeNull();
    expect(result.current.error).toBe("network down");
  });
});
