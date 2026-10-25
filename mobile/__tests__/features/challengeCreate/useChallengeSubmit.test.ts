import { act, renderHook } from "@testing-library/react-native";

import { useChallengeSubmit } from "../../../features/challengeCreate/hooks/useChallengeSubmit";
import { ApiError } from "../../../lib/apiErrors";
import i18n from "../../../lib/i18n";
import { createChallenge } from "../../../lib/social";

jest.mock("../../../lib/social", () => ({ createChallenge: jest.fn() }));
jest.mock("../../../lib/momentum", () => ({
  recordMomentumAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const REQUEST = {
  challenge_kind: "duel" as const,
  title: "shit week",
  target_sessions: 5,
  duration_days: 7,
  member_user_ids: [2],
};

describe("useChallengeSubmit", () => {
  it("explains a rejected title in the producer's language instead of the server's English", async () => {
    jest
      .mocked(createChallenge)
      .mockRejectedValue(
        new ApiError(422, "This contains language that isn't allowed.", null, "CONTENT_REJECTED"),
      );
    const { result } = renderHook(() => useChallengeSubmit("token", 1));

    await act(async () => {
      await result.current.submit(REQUEST);
    });

    expect(result.current.submitState).toEqual({
      status: "error",
      message: i18n.t("errors.contentRejected"),
    });
  });
});
