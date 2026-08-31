import { renderHook, waitFor } from "@testing-library/react-native";

import { useSessionDetailData } from "../../features/sessions/hooks/useSessionDetailData";
import { mockTFunction } from "../helpers/mockTFunction";
import { apiJson } from "../../lib/client";
import { tryParseSessionDto } from "../../lib/sessionDto";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/sessionDto", () => ({
  tryParseSessionDto: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockTryParseSessionDto = tryParseSessionDto as jest.MockedFunction<typeof tryParseSessionDto>;

const t = mockTFunction();
const noopRefreshSocial = jest.fn().mockResolvedValue(undefined);

const userASession = {
  id: 12,
  user_id: 1,
  started_at: "2026-04-21T10:00:00Z",
  stopped_at: "2026-04-21T11:00:00Z",
  duration_seconds: 3600,
  session_type: "beat_making",
  notes: "user a note",
};

const userBSession = {
  id: 12,
  user_id: 2,
  started_at: "2026-04-21T12:00:00Z",
  stopped_at: "2026-04-21T13:00:00Z",
  duration_seconds: 3600,
  session_type: "mixing",
  notes: "user b note",
};

const mockInsights = {
  focus_score: 88,
  paused_seconds: 0,
  focus_tier: "strong",
  focus_user_average: 75,
  impact_items: [],
  impact_lines: [],
  productivity_items: [],
  productivity_lines: [],
  timeline: [],
};

function renderDataHook(token: string | null, userId: number | null) {
  return renderHook(
    ({ token: hookToken, userId: hookUserId }: { token: string | null; userId: number | null }) =>
      useSessionDetailData({
        token: hookToken,
        userId: hookUserId,
        sessionId: "12",
        t,
        refreshSocial: noopRefreshSocial,
      }),
    { initialProps: { token, userId } },
  );
}

describe("useSessionDetailData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12/insights") return Promise.resolve(mockInsights);
      return Promise.resolve(userASession);
    });
    mockTryParseSessionDto.mockImplementation((value) => value as never);
  });

  it("loads session and insights for the signed-in user", async () => {
    const { result } = renderDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    expect(result.current.insights).toEqual(mockInsights);
    expect(result.current.error).toBeNull();
    expect(result.current.insightsError).toBeNull();
  });

  it("clears session and insights when token becomes null", async () => {
    const { result, rerender } = renderDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    rerender({ token: null, userId: null });

    expect(result.current.session).toBeNull();
    expect(result.current.insights).toBeNull();
    expect(result.current.insightsError).toBeNull();
    expect(result.current.error).toBe("sessionDetail.notSignedIn");
  });

  it("clears user A session and insights before user B data loads", async () => {
    const { result, rerender } = renderDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12/insights") return Promise.resolve(mockInsights);
      return Promise.resolve(userBSession);
    });

    rerender({ token: "token-b", userId: 2 });

    expect(result.current.session).toBeNull();
    expect(result.current.insights).toBeNull();

    await waitFor(() => {
      expect(result.current.session).toEqual(userBSession);
    });
  });

  it("ignores stale session responses after auth changes", async () => {
    let staleResolve: ((value: unknown) => void) | undefined;
    mockApiJson.mockImplementation(
      (path: string) =>
        path === "/sessions/item/12"
          ? new Promise((resolve) => {
              staleResolve = resolve;
            })
          : Promise.resolve(mockInsights),
    );

    const { result, rerender } = renderDataHook("token-a", 1);

    rerender({ token: "token-b", userId: 2 });

    staleResolve?.(userASession);
    await Promise.resolve();

    expect(result.current.session).toBeNull();
  });

  it("ignores stale insight responses after auth changes", async () => {
    const userAInsights = { ...mockInsights, focus_score: 11 };
    let staleInsightResolve: ((value: unknown) => void) | undefined;
    mockApiJson.mockImplementation((path: string, opts?: { token?: string | null }) => {
      if (path === "/sessions/item/12/insights" && opts?.token === "token-a") {
        return new Promise((resolve) => {
          staleInsightResolve = resolve;
        });
      }
      if (path === "/sessions/item/12/insights") return Promise.resolve(mockInsights);
      return Promise.resolve(userBSession);
    });

    const { result, rerender } = renderDataHook("token-a", 1);

    rerender({ token: "token-b", userId: 2 });

    await waitFor(() => {
      expect(result.current.session).toEqual(userBSession);
      expect(result.current.insights).toEqual(mockInsights);
    });

    staleInsightResolve?.(userAInsights);
    await Promise.resolve();

    expect(result.current.insights).toEqual(mockInsights);
    expect(result.current.insights?.focus_score).toBe(88);
  });

  it("preserves session detail state on same-user token refresh", async () => {
    const { result, rerender } = renderDataHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    mockApiJson.mockClear();

    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.session).toEqual(userASession);
    expect(result.current.insights).toEqual(mockInsights);
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it("loads normally for a new user after reset", async () => {
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12/insights") return Promise.resolve(mockInsights);
      return Promise.resolve(userBSession);
    });

    const { result } = renderDataHook("token-b", 2);

    await waitFor(() => {
      expect(result.current.session).toEqual(userBSession);
    });

    expect(result.current.insights).toEqual(mockInsights);
    expect(result.current.error).toBeNull();
  });

  it("shows not signed in error when token is missing", async () => {
    const { result } = renderDataHook(null, null);

    await waitFor(() => {
      expect(result.current.error).toBe("sessionDetail.notSignedIn");
    });

    expect(result.current.session).toBeNull();
    expect(result.current.insights).toBeNull();
  });
});
