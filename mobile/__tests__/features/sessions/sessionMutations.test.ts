import { affectsCountedSessions } from "../../../features/sessions/sessionMutations";

describe("affectsCountedSessions", () => {
  it("treats stop, delete and restore as writes that change counted hours", () => {
    expect(affectsCountedSessions({ path: "/sessions/stop", method: "POST" })).toBe(true);
    expect(affectsCountedSessions({ path: "/sessions/item/12", method: "DELETE" })).toBe(true);
    expect(affectsCountedSessions({ path: "/sessions/item/12/restore", method: "POST" })).toBe(true);
  });

  it("ignores writes that do not add or remove counted studio time", () => {
    expect(affectsCountedSessions({ path: "/sessions/item/12", method: "PATCH" })).toBe(false);
    expect(affectsCountedSessions({ path: "/sessions/start", method: "POST" })).toBe(false);
    expect(affectsCountedSessions({ path: "/social/challenges/4/join", method: "POST" })).toBe(false);
  });
});
