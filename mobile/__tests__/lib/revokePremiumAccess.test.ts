import {
  clearEntitlementCache,
  peekCachedHasPremiumAccess,
  revokePremiumAccess,
  seedEntitlementCache,
  subscribeEntitlementCache,
} from "../../lib/billing";
import { clearPersistedEntitlement } from "../../lib/entitlementStorage";

jest.mock("../../lib/client", () => ({ apiJson: jest.fn() }));

jest.mock("../../lib/entitlementStorage", () => ({
  clearPersistedEntitlement: jest.fn().mockResolvedValue(undefined),
  loadPersistedEntitlement: jest.fn().mockResolvedValue(null),
  persistEntitlement: jest.fn().mockResolvedValue(undefined),
}));

const PREMIUM = {
  provider: "revenuecat",
  entitlement: "premium",
  trial_active: false,
  expires_at: null,
} as const;

describe("revokePremiumAccess", () => {
  let nowMs = 10_000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockImplementation(() => nowMs);
    clearEntitlementCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("ends cached and stored access granted before the rejected request", async () => {
    nowMs = 10_000;
    seedEntitlementCache("token", PREMIUM, 7);

    await expect(revokePremiumAccess("token", 7, 20_000)).resolves.toBe(true);

    expect(peekCachedHasPremiumAccess("token")).toBe(false);
    expect(clearPersistedEntitlement).toHaveBeenCalledWith(7);
  });

  it("keeps a purchase that landed after the rejected request started", async () => {
    nowMs = 30_000;
    seedEntitlementCache("token", PREMIUM, 7);

    await expect(revokePremiumAccess("token", 7, 20_000)).resolves.toBe(false);

    expect(peekCachedHasPremiumAccess("token")).toBe(true);
    expect(clearPersistedEntitlement).not.toHaveBeenCalled();
  });

  it("notifies the access gate once even when parallel requests are rejected", async () => {
    nowMs = 10_000;
    seedEntitlementCache("token", PREMIUM, 7);
    const listener = jest.fn();
    const unsubscribe = subscribeEntitlementCache(listener);

    await Promise.all([
      revokePremiumAccess("token", 7, 20_000),
      revokePremiumAccess("token", 7, 20_000),
      revokePremiumAccess("token", 7, 20_000),
    ]);
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
