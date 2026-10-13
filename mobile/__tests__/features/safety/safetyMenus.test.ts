import { commentMenuActions, profileMenuActions } from "../../../features/safety/safetyMenus";

describe("commentMenuActions", () => {
  it("lets you delete your own comment", () => {
    expect(commentMenuActions({ isOwnComment: true, isSessionOwner: false })).toEqual(["delete"]);
  });

  it("lets the session owner delete, report or block a commenter", () => {
    expect(commentMenuActions({ isOwnComment: false, isSessionOwner: true })).toEqual([
      "delete",
      "report",
      "block",
    ]);
  });

  it("lets other viewers report or block the commenter", () => {
    expect(commentMenuActions({ isOwnComment: false, isSessionOwner: false })).toEqual(["report", "block"]);
  });
});

describe("profileMenuActions", () => {
  it("lets you report or block anyone else, friend or not", () => {
    expect(profileMenuActions("accepted")).toEqual(["report", "block"]);
    expect(profileMenuActions("none")).toEqual(["report", "block"]);
    expect(profileMenuActions("pending")).toEqual(["report", "block"]);
  });

  it("offers nothing on your own profile or before the relationship is known", () => {
    expect(profileMenuActions("self")).toEqual([]);
    expect(profileMenuActions(null)).toEqual([]);
  });
});
