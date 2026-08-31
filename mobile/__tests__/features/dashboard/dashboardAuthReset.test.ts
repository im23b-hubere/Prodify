import { shouldResetDashboardAuth } from "../../../features/dashboard/hooks/dashboardAuthReset";

describe("shouldResetDashboardAuth", () => {
  it("does not reset on first snapshot", () => {
    expect(
      shouldResetDashboardAuth({ token: "token-a", userId: 1 }, null),
    ).toBe(false);
  });

  it("resets when token becomes null", () => {
    expect(
      shouldResetDashboardAuth(
        { token: null, userId: null },
        { token: "token-a", userId: 1 },
      ),
    ).toBe(true);
  });

  it("resets when authenticated user changes", () => {
    expect(
      shouldResetDashboardAuth(
        { token: "token-b", userId: 2 },
        { token: "token-a", userId: 1 },
      ),
    ).toBe(true);
  });

  it("does not reset when the same user refreshes with a new token", () => {
    expect(
      shouldResetDashboardAuth(
        { token: "token-refreshed", userId: 1 },
        { token: "token-a", userId: 1 },
      ),
    ).toBe(false);
  });

  it("resets when identity becomes unresolved after a bound user", () => {
    expect(
      shouldResetDashboardAuth(
        { token: "token-b", userId: null },
        { token: "token-a", userId: 1 },
      ),
    ).toBe(true);
  });

  it("does not reset during initial unresolved identity", () => {
    expect(
      shouldResetDashboardAuth(
        { token: "token-a", userId: null },
        { token: "token-a", userId: null },
      ),
    ).toBe(false);
  });
});
