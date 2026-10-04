import { act, renderHook, waitFor } from "@testing-library/react-native";

import { requestChallengeSync } from "../../features/challenges/sync/challengeSync";
import { useDashboardSocialData } from "../../features/dashboard/hooks/useDashboardSocialData";
import { apiJson } from "../../lib/client";
import { fetchChallenges } from "../../lib/social";
import type { SocialChallengeDto } from "../../types/friends";
import { mockTFunction } from "../helpers/mockTFunction";

jest.mock("../../lib/client", () => ({
  apiJson: jest.fn(),
  subscribeSuccessfulMutations: jest.fn(() => () => undefined),
}));

jest.mock("../../lib/social", () => ({
  fetchBuddyRisk: jest.fn(() => Promise.resolve(null)),
  fetchCheckinStatus: jest.fn(() => Promise.resolve(null)),
  fetchCommitment: jest.fn(() => Promise.resolve(null)),
  fetchChallenges: jest.fn(),
  fetchIdentityState: jest.fn(() => Promise.resolve(null)),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockFetchChallenges = fetchChallenges as jest.MockedFunction<typeof fetchChallenges>;

const runningDuel = { id: 7, status: "active", challenge_kind: "duel", members: [] } as unknown as SocialChallengeDto;

function renderSocialData() {
  return renderHook(() => useDashboardSocialData("token", 1, mockTFunction()));
}

describe("useDashboardSocialData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiJson.mockResolvedValue([]);
    mockFetchChallenges.mockResolvedValue([runningDuel]);
  });

  it("keeps the last known challenges when only the challenge request fails", async () => {
    const { result } = renderSocialData();
    await act(() => result.current.loadSocial());
    mockFetchChallenges.mockRejectedValueOnce(new Error("timeout"));

    await act(() => result.current.loadSocial());

    expect(result.current.socialChallenges).toEqual([runningDuel]);
  });

  it("refreshes challenges in the background when a challenge sync is requested", async () => {
    const { result } = renderSocialData();
    await act(() => result.current.loadSocial());
    const finishedDuel = { ...runningDuel, status: "completed" } as SocialChallengeDto;
    mockFetchChallenges.mockResolvedValue([finishedDuel]);

    act(() => requestChallengeSync("changed"));

    expect(result.current.socialLoading).toBe(false);
    await waitFor(() => expect(result.current.socialChallenges).toEqual([finishedDuel]));
  });
});
