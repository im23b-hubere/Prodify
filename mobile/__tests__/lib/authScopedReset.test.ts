import { shouldResetAuthScope } from "../../lib/authScopedReset";

describe("shouldResetAuthScope", () => {
  it("does not reset on first snapshot", () => {
    expect(shouldResetAuthScope({ token: "token-a", userId: 1 }, null)).toBe(false);
  });

  it("resets when token becomes null", () => {
    expect(
      shouldResetAuthScope({ token: null, userId: null }, { token: "token-a", userId: 1 }),
    ).toBe(true);
  });

  it("resets when authenticated user changes", () => {
    expect(
      shouldResetAuthScope({ token: "token-b", userId: 2 }, { token: "token-a", userId: 1 }),
    ).toBe(true);
  });

  it("does not reset when the same user refreshes with a new token", () => {
    expect(
      shouldResetAuthScope(
        { token: "token-refreshed", userId: 1 },
        { token: "token-a", userId: 1 },
      ),
    ).toBe(false);
  });

  it("resets when identity becomes unresolved after a bound user", () => {
    expect(
      shouldResetAuthScope({ token: "token-b", userId: null }, { token: "token-a", userId: 1 }),
    ).toBe(true);
  });

  it("does not reset during initial unresolved identity", () => {
    expect(
      shouldResetAuthScope({ token: "token-a", userId: null }, { token: "token-a", userId: null }),
    ).toBe(false);
  });
});

describe("shouldResetDashboardAuth re-export", () => {
  it("matches shouldResetAuthScope", () => {
    const { shouldResetDashboardAuth } = require("../../features/dashboard/hooks/dashboardAuthReset");
    expect(shouldResetDashboardAuth).toBe(shouldResetAuthScope);
  });
});
