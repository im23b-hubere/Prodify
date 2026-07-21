import { fetchEntitlement, hasPremiumAccess, seedEntitlementCache } from "../../lib/billing";
import { resolvePremiumAccess } from "../../lib/premiumAccess";
import { configureRevenueCat, getRevenueCatCustomerInfo } from "../../lib/revenuecat";

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: () => false,
}));

jest.mock("../../lib/devBillingBypass", () => ({
  isDevBillingBypassActive: jest.fn(async () => false),
}));

jest.mock("../../lib/entitlementStorage", () => ({
  loadPersistedEntitlement: jest.fn(async () => null),
}));

jest.mock("../../lib/billing", () => ({
  fetchEntitlement: jest.fn(),
  hasPremiumAccess: jest.requireActual("../../lib/billing").hasPremiumAccess,
  peekCachedHasPremiumAccess: jest.fn(() => null),
  seedEntitlementCache: jest.fn(),
  syncEntitlement: jest.fn(async () => ({
    provider: "revenuecat",
    entitlement: "premium",
    trial_active: false,
    expires_at: null,
  })),
}));

jest.mock("../../lib/revenuecat", () => ({
  configureRevenueCat: jest.fn(async () => undefined),
  getRevenueCatCustomerInfo: jest.fn(),
  isPremiumActive: jest.fn(
    (info: { entitlements?: { active?: Record<string, unknown> } }) =>
      Boolean(info?.entitlements?.active?.app_access),
  ),
  activeEntitlementExpiration: jest.fn(() => null),
}));

describe("resolvePremiumAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true immediately when the server already reports premium (no RevenueCat wait)", async () => {
    (fetchEntitlement as jest.Mock).mockResolvedValue({
      provider: "revenuecat",
      entitlement: "premium",
      trial_active: false,
      expires_at: null,
    });

    await expect(resolvePremiumAccess("tok", "42")).resolves.toBe(true);
    expect(configureRevenueCat).not.toHaveBeenCalled();
    expect(getRevenueCatCustomerInfo).not.toHaveBeenCalled();
  });

  it("probes RevenueCat only after the server reports free", async () => {
    (fetchEntitlement as jest.Mock).mockResolvedValue({
      provider: "revenuecat",
      entitlement: "free",
      trial_active: false,
      expires_at: null,
    });
    (getRevenueCatCustomerInfo as jest.Mock).mockResolvedValue({
      entitlements: { active: { app_access: {} } },
    });

    await expect(resolvePremiumAccess("tok", "42")).resolves.toBe(true);
    expect(configureRevenueCat).toHaveBeenCalledWith("42");
    expect(getRevenueCatCustomerInfo).toHaveBeenCalled();
  });

  it(
    "returns false for free users without waiting on a hanging RevenueCat call forever",
    async () => {
      (fetchEntitlement as jest.Mock).mockResolvedValue({
        provider: "revenuecat",
        entitlement: "free",
        trial_active: false,
        expires_at: null,
      });
      (getRevenueCatCustomerInfo as jest.Mock).mockImplementation(
        () => new Promise(() => undefined),
      );

      const started = Date.now();
      await expect(resolvePremiumAccess("tok", "42")).resolves.toBe(false);
      expect(Date.now() - started).toBeLessThan(8_000);
      expect(hasPremiumAccess({ entitlement: "free" } as never)).toBe(false);
      expect(seedEntitlementCache).not.toHaveBeenCalled();
    },
    12_000,
  );
});
