import { renderHook, waitFor } from "@testing-library/react-native";

import { useSessionReactions } from "../../features/sessions/hooks/useSessionReactions";
import { mockTFunction } from "../helpers/mockTFunction";
import { fetchSessionReactions } from "../../lib/social";
import type { SocialReactionDto } from "../../types/friends";

jest.mock("../../lib/social", () => ({
  fetchSessionReactions: jest.fn(),
  toggleSessionReaction: jest.fn(),
}));

const mockFetchSessionReactions = fetchSessionReactions as jest.MockedFunction<
  typeof fetchSessionReactions
>;

const t = mockTFunction();

const userAReactions: SocialReactionDto[] = [
  { target_type: "session", target_id: 12, emoji: "🔥", count: 1, reacted_by_me: true },
];

const userBReactions: SocialReactionDto[] = [
  { target_type: "session", target_id: 12, emoji: "👏", count: 2, reacted_by_me: false },
];

function renderReactionsHook(token: string | null, userId: number | null) {
  return renderHook(
    ({ token: hookToken, userId: hookUserId }: { token: string | null; userId: number | null }) =>
      useSessionReactions(hookToken, hookUserId, "12", t),
    { initialProps: { token, userId } },
  );
}

describe("useSessionReactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSessionReactions.mockResolvedValue(userAReactions);
  });

  it("clears reactions when token becomes null", async () => {
    const { result, rerender } = renderReactionsHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.reactions).toEqual(userAReactions);
    });

    rerender({ token: null, userId: null });

    expect(result.current.reactions).toEqual([]);
    expect(result.current.reactionsError).toBeNull();
    expect(result.current.reactionsLoading).toBe(false);
  });

  it("clears user A reactions before user B data loads", async () => {
    const { result, rerender } = renderReactionsHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.reactions).toEqual(userAReactions);
    });

    mockFetchSessionReactions.mockResolvedValue(userBReactions);
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.reactions).toEqual([]);

    await waitFor(() => {
      expect(result.current.reactions).toEqual(userBReactions);
    });
  });

  it("ignores stale reaction responses after auth changes", async () => {
    let staleResolve: ((value: SocialReactionDto[]) => void) | undefined;
    mockFetchSessionReactions.mockImplementation((token: string) => {
      if (token === "token-a") {
        return new Promise<SocialReactionDto[]>((resolve) => {
          staleResolve = resolve;
        });
      }
      return Promise.resolve(userBReactions);
    });

    const { result, rerender } = renderReactionsHook("token-a", 1);

    rerender({ token: "token-b", userId: 2 });

    await waitFor(() => {
      expect(result.current.reactions).toEqual(userBReactions);
    });

    staleResolve?.(userAReactions);
    await Promise.resolve();

    expect(result.current.reactions).toEqual(userBReactions);
  });

  it("preserves reactions on same-user token refresh", async () => {
    const { result, rerender } = renderReactionsHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.reactions).toEqual(userAReactions);
    });

    mockFetchSessionReactions.mockClear();
    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.reactions).toEqual(userAReactions);
    expect(mockFetchSessionReactions).not.toHaveBeenCalled();
  });
});
