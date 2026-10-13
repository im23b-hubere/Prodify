import {
  blockUser,
  deleteSessionComment,
  fetchBlockedUsers,
  reportComment,
  reportUser,
  unblockUser,
} from "../../lib/moderation";

const mockApiJson = jest.fn();

jest.mock("../../lib/client", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

beforeEach(() => {
  mockApiJson.mockReset();
  mockApiJson.mockResolvedValue(null);
});

describe("moderation api", () => {
  it("blocks and unblocks a user", async () => {
    await blockUser("tok", 7);
    await unblockUser("tok", 7);

    expect(mockApiJson).toHaveBeenNthCalledWith(1, "/users/7/block", { token: "tok", method: "POST" });
    expect(mockApiJson).toHaveBeenNthCalledWith(2, "/users/7/block", { token: "tok", method: "DELETE" });
  });

  it("lists blocked users", async () => {
    mockApiJson.mockResolvedValue([{ user_id: 7, username: "bob" }]);

    await expect(fetchBlockedUsers("tok")).resolves.toEqual([{ user_id: 7, username: "bob" }]);
    expect(mockApiJson).toHaveBeenCalledWith("/users/me/blocked", { token: "tok" });
  });

  it("reports a user with a trimmed note", async () => {
    await reportUser("tok", 7, { reason: "harassment", note: "  keeps messaging me  " });

    expect(mockApiJson).toHaveBeenCalledWith("/reports", {
      token: "tok",
      method: "POST",
      body: { target_type: "user", user_id: 7, reason: "harassment", note: "keeps messaging me" },
    });
  });

  it("reports a comment and leaves a blank note out", async () => {
    await reportComment("tok", 12, { reason: "spam", note: "   " });

    expect(mockApiJson).toHaveBeenCalledWith("/reports", {
      token: "tok",
      method: "POST",
      body: { target_type: "comment", comment_id: 12, reason: "spam", note: null },
    });
  });

  it("deletes a comment on a session", async () => {
    await deleteSessionComment("tok", 3, 12);

    expect(mockApiJson).toHaveBeenCalledWith("/social/feed/3/comments/12", { token: "tok", method: "DELETE" });
  });
});
