import { finalizePremiumUnlock } from "../../../features/paywall/usePremiumUnlockFinalizer";
import { seedEntitlementCache, syncEntitlement } from "../../../lib/billing";

jest.mock("../../../lib/billing", () => ({
  seedEntitlementCache: jest.fn(),
  syncEntitlement: jest.fn(),
}));

jest.mock("../../../lib/revenuecat", () => ({
  activeEntitlementExpiration: jest.fn(() => "2026-09-01T00:00:00Z"),
}));

function options() {
  return {
    token: "token",
    appUserId: "42",
    refreshUser: jest.fn().mockResolvedValue(undefined),
    requestExitAfterUnlock: jest.fn(),
    info: {} as never,
    showConfirmation: true,
  };
}

describe("premium unlock finalizer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("seeds access immediately, syncs the backend and exits once", async () => {
    (syncEntitlement as jest.Mock).mockResolvedValue({ entitlement: "premium" });
    const input = options();

    await finalizePremiumUnlock(input);

    expect(seedEntitlementCache).toHaveBeenCalledTimes(1);
    expect(seedEntitlementCache).toHaveBeenCalledWith(
      "token",
      {
        provider: "revenuecat",
        entitlement: "premium",
        trial_active: false,
        expires_at: "2026-09-01T00:00:00Z",
      },
      42,
    );
    expect(syncEntitlement).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ app_user_id: "42", entitlement: "premium" }),
    );
    expect(input.refreshUser).toHaveBeenCalledTimes(1);
    expect(input.requestExitAfterUnlock).toHaveBeenCalledWith(true);
  });

  it("restores the optimistic premium cache when backend sync cannot confirm access", async () => {
    (syncEntitlement as jest.Mock).mockResolvedValue(null);
    const input = options();

    await finalizePremiumUnlock(input);

    expect(seedEntitlementCache).toHaveBeenCalledTimes(2);
    expect(input.requestExitAfterUnlock).toHaveBeenCalledTimes(1);
  });

  it("exits without backend work for an anonymous preview unlock", async () => {
    const input = {
      ...options(),
      token: null,
      appUserId: null,
      info: null,
      expiresAt: null,
    };

    await finalizePremiumUnlock(input);

    expect(seedEntitlementCache).not.toHaveBeenCalled();
    expect(syncEntitlement).not.toHaveBeenCalled();
    expect(input.refreshUser).not.toHaveBeenCalled();
    expect(input.requestExitAfterUnlock).toHaveBeenCalledWith(true);
  });
});
