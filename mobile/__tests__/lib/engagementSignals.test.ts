import { notificationIdOf } from "../../lib/engagementSignals";

describe("notificationIdOf", () => {
  it("reads the delivery id the server attached to the push", () => {
    expect(notificationIdOf({ kind: "streak_2h_left", nid: "4b8f0a52-1c1e-4ac8-9a4e-6b7d1f0e2c11" })).toBe(
      "4b8f0a52-1c1e-4ac8-9a4e-6b7d1f0e2c11",
    );
  });

  it("returns null for local notifications without a server id", () => {
    expect(notificationIdOf({ kind: "streak-risk" })).toBeNull();
    expect(notificationIdOf(undefined)).toBeNull();
  });

  it("rejects ids that are not plain uuid-like strings", () => {
    expect(notificationIdOf({ nid: "../../users/me" })).toBeNull();
    expect(notificationIdOf({ nid: 42 })).toBeNull();
  });
});
