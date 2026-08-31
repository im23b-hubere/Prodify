import { renderHook, waitFor } from "@testing-library/react-native";

import { useSessionDetailData } from "../../features/sessions/hooks/useSessionDetailData";
import { useSessionSocial } from "../../features/sessions/hooks/useSessionSocial";
import { mockTFunction } from "../helpers/mockTFunction";
import { apiJson } from "../../lib/client";
import { tryParseSessionDto } from "../../lib/sessionDto";
import { fetchSessionComments, fetchSessionReactions } from "../../lib/social";
import type { SocialCommentDto, SocialReactionDto } from "../../types/friends";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
}));

jest.mock("../../lib/sessionDto", () => ({
  tryParseSessionDto: jest.fn(),
}));

jest.mock("../../lib/social", () => ({
  fetchSessionComments: jest.fn(),
  fetchSessionReactions: jest.fn(),
  createSessionComment: jest.fn(),
  toggleSessionReaction: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockTryParseSessionDto = tryParseSessionDto as jest.MockedFunction<typeof tryParseSessionDto>;
const mockFetchSessionComments = fetchSessionComments as jest.MockedFunction<
  typeof fetchSessionComments
>;
const mockFetchSessionReactions = fetchSessionReactions as jest.MockedFunction<
  typeof fetchSessionReactions
>;

const t = mockTFunction();

const userASession = {
  id: 12,
  user_id: 1,
  started_at: "2026-04-21T10:00:00Z",
  stopped_at: "2026-04-21T11:00:00Z",
  duration_seconds: 3600,
  session_type: "beat_making",
};

const userAComments: SocialCommentDto[] = [
  {
    id: 1,
    target_type: "session",
    target_id: 12,
    author_id: 1,
    author_username: "a",
    body: "a",
    created_at: "2026-04-21T10:00:00Z",
  },
];
const userAReactions: SocialReactionDto[] = [
  { target_type: "session", target_id: 12, emoji: "🔥", count: 1, reacted_by_me: true },
];
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

function useSessionDetailAuthScope(token: string | null, userId: number | null) {
  const social = useSessionSocial({ token, userId, sessionId: "12", t });
  const data = useSessionDetailData({
    token,
    userId,
    sessionId: "12",
    t,
    refreshSocial: social.refresh,
  });
  return { ...data, ...social };
}

describe("session detail auth scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockImplementation((path: string) => {
      if (path === "/sessions/item/12/insights") return Promise.resolve(mockInsights);
      return Promise.resolve(userASession);
    });
    mockTryParseSessionDto.mockImplementation((value) => value as never);
    mockFetchSessionComments.mockResolvedValue(userAComments);
    mockFetchSessionReactions.mockResolvedValue(userAReactions);
  });

  it("clears session, insights, comments, and reactions on sign-out", async () => {
    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useSessionDetailAuthScope(token, userId),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
      expect(result.current.comments).toEqual(userAComments);
      expect(result.current.reactions).toEqual(userAReactions);
    });

    rerender({ token: null, userId: null });

    expect(result.current.session).toBeNull();
    expect(result.current.insights).toBeNull();
    expect(result.current.comments).toEqual([]);
    expect(result.current.reactions).toEqual([]);
    expect(result.current.error).toBe("sessionDetail.notSignedIn");
  });

  it("clears all user A content immediately on account switch", async () => {
    const { result, rerender } = renderHook(
      ({ token, userId }: { token: string | null; userId: number | null }) =>
        useSessionDetailAuthScope(token, userId),
      { initialProps: { token: "token-a", userId: 1 } },
    );

    await waitFor(() => {
      expect(result.current.session).toEqual(userASession);
    });

    rerender({ token: "token-b", userId: 2 });

    expect(result.current.session).toBeNull();
    expect(result.current.insights).toBeNull();
    expect(result.current.comments).toEqual([]);
    expect(result.current.reactions).toEqual([]);
  });
});
