import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useBlockedUsers } from "../../../features/safety/hooks/useBlockedUsers";
import { mockTFunction } from "../../helpers/mockTFunction";

const mockFetchBlockedUsers = jest.fn();
const mockUnblockUser = jest.fn();

jest.mock("../../../lib/moderation", () => ({
  fetchBlockedUsers: (...args: unknown[]) => mockFetchBlockedUsers(...args),
  unblockUser: (...args: unknown[]) => mockUnblockUser(...args),
}));

const t = mockTFunction();
const bob = { user_id: 7, username: "bob", profile_picture_url: null, blocked_at: "2026-10-12T10:00:00Z" };
const eve = { user_id: 8, username: "eve", profile_picture_url: null, blocked_at: "2026-10-11T10:00:00Z" };

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchBlockedUsers.mockResolvedValue([bob, eve]);
  mockUnblockUser.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("useBlockedUsers", () => {
  it("loads the blocked users", async () => {
    const { result } = renderHook(() => useBlockedUsers("tok", t));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.users).toEqual([bob, eve]);
  });

  it("reports a failed load", async () => {
    mockFetchBlockedUsers.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useBlockedUsers("tok", t));

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("removes a user from the list once unblocked", async () => {
    const { result } = renderHook(() => useBlockedUsers("tok", t));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(() => result.current.unblock(bob));

    expect(mockUnblockUser).toHaveBeenCalledWith("tok", 7);
    expect(result.current.users).toEqual([eve]);
    expect(result.current.unblockingIds).toEqual([]);
  });

  it("keeps the user listed and explains when unblocking failed", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockUnblockUser.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useBlockedUsers("tok", t));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(() => result.current.unblock(bob));

    expect(result.current.users).toEqual([bob, eve]);
    expect(alert).toHaveBeenCalledWith("safety.blocked.unblockFailed", "common.tryAgain");
  });
});
