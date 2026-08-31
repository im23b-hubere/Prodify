import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useActiveSessionLoader } from "../../features/sessions/hooks/useActiveSessionLoader";
import {
  fetchActiveSession,
  fetchLongestCompletedSessionSeconds,
  resolveActiveSessionId,
} from "../../features/sessions/services/activeSessionApi";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../features/sessions/services/activeSessionApi", () => ({
  resolveActiveSessionId: jest.fn(),
  fetchActiveSession: jest.fn(),
  fetchLongestCompletedSessionSeconds: jest.fn(),
}));

const mockResolveActiveSessionId = resolveActiveSessionId as jest.MockedFunction<
  typeof resolveActiveSessionId
>;
const mockFetchActiveSession = fetchActiveSession as jest.MockedFunction<typeof fetchActiveSession>;
const mockFetchLongestCompletedSessionSeconds =
  fetchLongestCompletedSessionSeconds as jest.MockedFunction<
    typeof fetchLongestCompletedSessionSeconds
  >;

const userASession = {
  id: 42,
  started_at: "2026-08-31T10:00:00.000Z",
  stopped_at: null,
  session_type: "beat_making",
  duration_seconds: null,
};

const userBSession = {
  id: 99,
  started_at: "2026-08-31T11:00:00.000Z",
  stopped_at: null,
  session_type: "mixing",
  duration_seconds: null,
};

describe("useActiveSessionLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveActiveSessionId.mockResolvedValue(42);
    mockFetchActiveSession.mockResolvedValue(userASession as never);
    mockFetchLongestCompletedSessionSeconds.mockResolvedValue(3600);
  });

  it("loads active session and longest completed seconds for the signed-in user", async () => {
    const { result } = renderHook(() => useActiveSessionLoader("token-a", 1, "42"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(userASession);
    expect(result.current.longestCompletedSeconds).toBe(3600);
    expect(result.current.error).toBeNull();
  });

  it("clears user A session state when token becomes null", async () => {
    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useActiveSessionLoader(token, userId, "42"),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    rerender({ token: null, userId: null });

    expect(result.current.session).toBeNull();
    expect(result.current.longestCompletedSeconds).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("clears user A session state before user B data loads", async () => {
    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useActiveSessionLoader(token, userId, "42"),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    mockResolveActiveSessionId.mockResolvedValue(99);
    mockFetchActiveSession.mockResolvedValue(userBSession as never);
    mockFetchLongestCompletedSessionSeconds.mockResolvedValue(7200);

    rerender({ token: "token-b", userId: 2 });

    expect(result.current.session).toBeNull();
    expect(result.current.longestCompletedSeconds).toBeNull();

    await waitFor(() => {
      expect(result.current.session).toEqual(userBSession);
    });

    expect(result.current.longestCompletedSeconds).toBe(7200);
  });

  it("ignores stale active session responses after auth changes", async () => {
    let staleResolve: ((value: unknown) => void) | undefined;
    mockFetchActiveSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          staleResolve = resolve as (value: unknown) => void;
        }),
    );

    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useActiveSessionLoader(token, userId, "42"),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(userASession as never);
    await Promise.resolve();

    expect(result.current.session).toBeNull();
  });

  it("ignores stale longestCompletedSeconds responses after auth changes", async () => {
    let staleResolve: ((value: number | null) => void) | undefined;
    mockFetchLongestCompletedSessionSeconds.mockImplementation((token: string) => {
      if (token === "token-a") {
        return new Promise((resolve) => {
          staleResolve = resolve;
        });
      }
      return Promise.resolve(7200);
    });

    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useActiveSessionLoader(token, userId, "42"),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    rerender({ token: "token-b", userId: 2 });

    await waitFor(() => {
      expect(result.current.longestCompletedSeconds).toBe(7200);
    });

    staleResolve?.(3600);
    await Promise.resolve();

    expect(result.current.longestCompletedSeconds).toBe(7200);
  });

  it("preserves session state on same-user token refresh", async () => {
    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useActiveSessionLoader(token, userId, "42"),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    mockFetchActiveSession.mockClear();
    mockFetchLongestCompletedSessionSeconds.mockClear();

    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.session).toEqual(userASession);
    expect(result.current.longestCompletedSeconds).toBe(3600);
    expect(mockFetchActiveSession).not.toHaveBeenCalled();
    expect(mockFetchLongestCompletedSessionSeconds).not.toHaveBeenCalled();
  });

  it("loads normally for a new user after reset", async () => {
    mockResolveActiveSessionId.mockResolvedValue(99);
    mockFetchActiveSession.mockResolvedValue(userBSession as never);
    mockFetchLongestCompletedSessionSeconds.mockResolvedValue(5400);

    const { result } = renderHook(() => useActiveSessionLoader("token-b", 2, "99"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(userBSession);
    expect(result.current.longestCompletedSeconds).toBe(5400);
    expect(result.current.error).toBeNull();
  });
});
