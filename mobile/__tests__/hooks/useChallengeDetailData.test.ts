import { act, renderHook, waitFor } from "@testing-library/react-native";

import { requestChallengeSync } from "../../features/challenges/sync/challengeSync";
import { useChallengeDetailData } from "../../features/challenges/hooks/useChallengeDetailData";
import { fetchChallenge } from "../../lib/social";
import type { SocialChallengeDto } from "../../types/friends";

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(effect, [effect]);
  },
}));

jest.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

jest.mock("../../lib/client", () => ({
  subscribeSuccessfulMutations: jest.fn(() => () => undefined),
}));

jest.mock("../../lib/social", () => ({
  fetchChallenge: jest.fn(),
}));

const mockFetchChallenge = fetchChallenge as jest.MockedFunction<typeof fetchChallenge>;

function duel(progress: number): SocialChallengeDto {
  return {
    id: 3,
    status: "active",
    challenge_kind: "duel",
    members: [{ user_id: 1, username: "me", progress_sessions: progress }],
  } as unknown as SocialChallengeDto;
}

async function renderLoadedDetail() {
  mockFetchChallenge.mockResolvedValue(duel(1));
  const hook = renderHook(() => useChallengeDetailData("token", 3));
  await waitFor(() => expect(hook.result.current.challenge).toEqual(duel(1)));
  return hook;
}

describe("useChallengeDetailData", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the shown challenge when a pull to refresh fails", async () => {
    const { result } = await renderLoadedDetail();
    mockFetchChallenge.mockRejectedValueOnce(new Error("offline"));

    await act(() => result.current.load({ silent: true }));

    expect(result.current.challenge).toEqual(duel(1));
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);
  });

  it("picks up new progress quietly when a challenge sync is requested", async () => {
    const { result } = await renderLoadedDetail();
    mockFetchChallenge.mockResolvedValue(duel(2));

    act(() => requestChallengeSync("changed"));

    expect(result.current.refreshing).toBe(false);
    await waitFor(() => expect(result.current.challenge).toEqual(duel(2)));
  });
});
