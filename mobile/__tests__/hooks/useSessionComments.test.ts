import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useSessionComments } from "../../features/sessions/hooks/useSessionComments";
import { mockTFunction } from "../helpers/mockTFunction";
import { ApiError } from "../../lib/client";
import { createSessionComment, fetchSessionComments } from "../../lib/social";
import type { SocialCommentDto } from "../../types/friends";

jest.mock("../../lib/social", () => ({
  fetchSessionComments: jest.fn(),
  createSessionComment: jest.fn(),
}));

const mockFetchSessionComments = fetchSessionComments as jest.MockedFunction<
  typeof fetchSessionComments
>;

const t = mockTFunction();

const userAComments: SocialCommentDto[] = [
  {
    id: 1,
    target_type: "session",
    target_id: 12,
    author_id: 1,
    author_username: "user-a",
    body: "comment from user a",
    created_at: "2026-04-21T10:00:00Z",
  },
];

const userBComments: SocialCommentDto[] = [
  {
    id: 2,
    target_type: "session",
    target_id: 12,
    author_id: 2,
    author_username: "user-b",
    body: "comment from user b",
    created_at: "2026-04-21T11:00:00Z",
  },
];

function renderCommentsHook(token: string | null, userId: number | null) {
  return renderHook(
    ({ token: hookToken, userId: hookUserId }: { token: string | null; userId: number | null }) =>
      useSessionComments(hookToken, hookUserId, "12", t),
    { initialProps: { token, userId } },
  );
}

describe("useSessionComments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSessionComments.mockResolvedValue(userAComments);
  });

  it("explains a comment the language filter rejected and keeps the draft", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    jest
      .mocked(createSessionComment)
      .mockRejectedValue(new ApiError(422, "ignored", null, "CONTENT_REJECTED"));
    const { result } = renderCommentsHook("token-a", 1);
    await waitFor(() => expect(result.current.comments).toEqual(userAComments));

    act(() => result.current.setCommentInput("rude words"));
    await act(() => result.current.submitComment());

    expect(alert).toHaveBeenCalledWith("friendsScreen.couldNotSendComment", "safety.comment.rejected");
    expect(result.current.commentInput).toBe("rude words");
    alert.mockRestore();
  });

  it("clears comments when token becomes null", async () => {
    const { result, rerender } = renderCommentsHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.comments).toEqual(userAComments);
    });

    rerender({ token: null, userId: null });

    expect(result.current.comments).toEqual([]);
    expect(result.current.commentsError).toBeNull();
    expect(result.current.commentsLoading).toBe(false);
  });

  it("clears user A comments before user B data loads", async () => {
    const { result, rerender } = renderCommentsHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.comments).toEqual(userAComments);
    });

    mockFetchSessionComments.mockResolvedValue(userBComments);
    rerender({ token: "token-b", userId: 2 });

    expect(result.current.comments).toEqual([]);

    await waitFor(() => {
      expect(result.current.comments).toEqual(userBComments);
    });
  });

  it("ignores stale comment responses after auth changes", async () => {
    let staleResolve: ((value: SocialCommentDto[]) => void) | undefined;
    mockFetchSessionComments.mockImplementation((token: string) => {
      if (token === "token-a") {
        return new Promise<SocialCommentDto[]>((resolve) => {
          staleResolve = resolve;
        });
      }
      return Promise.resolve(userBComments);
    });

    const { result, rerender } = renderCommentsHook("token-a", 1);

    rerender({ token: "token-b", userId: 2 });

    await waitFor(() => {
      expect(result.current.comments).toEqual(userBComments);
    });

    staleResolve?.(userAComments);
    await Promise.resolve();

    expect(result.current.comments).toEqual(userBComments);
  });

  it("preserves comments on same-user token refresh", async () => {
    const { result, rerender } = renderCommentsHook("token-a", 1);

    await waitFor(() => {
      expect(result.current.comments).toEqual(userAComments);
    });

    mockFetchSessionComments.mockClear();
    rerender({ token: "token-refreshed", userId: 1 });

    expect(result.current.comments).toEqual(userAComments);
    expect(mockFetchSessionComments).not.toHaveBeenCalled();
  });
});
