import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useChallengeDetail } from "../../../features/challenges/hooks/useChallengeDetail";
import type { SocialChallengeDto } from "../../../types/friends";

const mockBack = jest.fn();
const mockFetchChallenge = jest.fn();
const mockUpdateChallenge = jest.fn();
const mockCancelChallenge = jest.fn();
const mockJoinChallenge = jest.fn();
const mockLeaveChallenge = jest.fn();
const mockTranslate = (key: string) => key;

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useRouter: () => ({ back: mockBack }),
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock("../../../lib/social", () => ({
  fetchChallenge: (...args: unknown[]) => mockFetchChallenge(...args),
  updateChallenge: (...args: unknown[]) => mockUpdateChallenge(...args),
  cancelChallenge: (...args: unknown[]) => mockCancelChallenge(...args),
  joinSocialChallenge: (...args: unknown[]) => mockJoinChallenge(...args),
  leaveChallenge: (...args: unknown[]) => mockLeaveChallenge(...args),
}));

const challenge: SocialChallengeDto = {
  id: 9,
  owner_id: 1,
  challenge_kind: "duel",
  title: "Finish tracks",
  week_start: "2026-08-10",
  target_sessions: 5,
  duration_days: 7,
  status: "active",
  members: [
    { user_id: 1, username: "Ada", progress_sessions: 4 },
    { user_id: 2, username: "Lin", progress_sessions: 2 },
  ],
};

describe("useChallengeDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchChallenge.mockResolvedValue(challenge);
    mockUpdateChallenge.mockResolvedValue(challenge);
    mockCancelChallenge.mockResolvedValue(undefined);
    mockJoinChallenge.mockResolvedValue(challenge);
    mockLeaveChallenge.mockResolvedValue(undefined);
  });

  it("loads the challenge and derives membership summary", async () => {
    const { result } = renderHook(() => useChallengeDetail("token", 9, 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchChallenge).toHaveBeenCalledWith("token", 9);
    expect(result.current.isMember).toBe(true);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.leaderMember?.username).toBe("Ada");
    expect(result.current.totalSessions).toBe(6);
  });

  it("normalizes and saves an edited draft", async () => {
    const updated = { ...challenge, title: "New title" };
    mockUpdateChallenge.mockResolvedValue(updated);
    const { result } = renderHook(() => useChallengeDetail("token", 9, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.openEdit();
      result.current.setEditTitle("  New title  ");
      result.current.setEditTarget("6");
      result.current.setEditDuration("14");
    });
    await act(async () => result.current.submitEdit());

    expect(mockUpdateChallenge).toHaveBeenCalledWith("token", 9, {
      title: "New title",
      target_sessions: 6,
      duration_days: 14,
    });
    expect(result.current.challenge?.title).toBe("New title");
    expect(result.current.editOpen).toBe(false);
  });

  it("runs a destructive cancel only after confirmation", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const { result } = renderHook(() => useChallengeDetail("token", 9, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(result.current.confirmCancel);
    expect(mockCancelChallenge).not.toHaveBeenCalled();
    const buttons = alert.mock.calls.at(-1)?.[2];
    await act(async () => buttons?.[1]?.onPress?.());

    await waitFor(() => expect(mockCancelChallenge).toHaveBeenCalledWith("token", 9));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
