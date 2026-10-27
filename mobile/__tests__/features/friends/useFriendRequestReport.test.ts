import { act, renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { useFriendRequestReport } from "../../../features/friends/hooks/useFriendRequestReport";
import type { FriendIncomingDto } from "../../../types/friends";

const t = ((key: string) => key) as TFunction;

const request: FriendIncomingDto = {
  id: 42,
  user_id: 3,
  username: "carol",
  profile_picture_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("useFriendRequestReport", () => {
  it("reports the person who sent the request", () => {
    const { result } = renderHook(() => useFriendRequestReport("token", t, jest.fn()));

    act(() => result.current.reportRequest(request));

    expect(result.current.report.target).toEqual({ kind: "user", userId: 3, name: "carol" });
  });

  it("closes the report and declines with a block when the reporter also blocks", () => {
    const declineAndBlock = jest.fn();
    const { result } = renderHook(() => useFriendRequestReport("token", t, declineAndBlock));
    act(() => result.current.reportRequest(request));

    act(() => result.current.blockAfterReport());

    expect(result.current.report.target).toBeNull();
    expect(declineAndBlock).toHaveBeenCalledWith({ user_id: 3, username: "carol" });
  });
});
