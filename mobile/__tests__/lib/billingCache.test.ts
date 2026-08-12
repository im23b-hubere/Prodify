import {
  clearEntitlementCache,
  fetchEntitlement,
  getCachedEntitlement,
  getEntitlementCacheRevision,
  seedEntitlementCache,
  subscribeEntitlementCache,
} from "../../lib/billing";
import { apiJson } from "../../lib/client";

jest.mock("../../lib/client", () => ({ apiJson: jest.fn() }));
jest.mock("../../lib/devBillingBypass", () => ({
  isDevBillingBypassActive: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../lib/entitlementStorage", () => ({
  clearPersistedEntitlement: jest.fn().mockResolvedValue(undefined),
  loadPersistedEntitlement: jest.fn().mockResolvedValue(null),
  persistEntitlement: jest.fn().mockResolvedValue(undefined),
}));

const premium = {
  provider: "revenuecat",
  entitlement: "premium" as const,
  trial_active: false,
  expires_at: "2099-01-01T00:00:00.000Z",
};

describe("billing entitlement cache subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearEntitlementCache();
  });

  it("notifies access gates when premium is seeded", () => {
    const listener = jest.fn();
    const revisionBefore = getEntitlementCacheRevision();
    const unsubscribe = subscribeEntitlementCache(listener);

    seedEntitlementCache("token", premium, 1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getEntitlementCacheRevision()).toBe(revisionBefore + 1);
    unsubscribe();
  });

  it("does not notify repeatedly for the same entitlement snapshot", () => {
    seedEntitlementCache("token", premium, 1);
    const listener = jest.fn();
    const unsubscribe = subscribeEntitlementCache(listener);

    seedEntitlementCache("token", premium, 1);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not let an older free response overwrite a newer premium grant", async () => {
    let resolveServer!: (value: unknown) => void;
    (apiJson as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveServer = resolve;
      }),
    );

    const pending = fetchEntitlement("token", { force: true, userId: 1 });
    seedEntitlementCache("token", premium, 1);
    resolveServer({
      provider: "revenuecat",
      entitlement: "free",
      trial_active: false,
      expires_at: null,
    });

    await expect(pending).resolves.toEqual(premium);
    expect(getCachedEntitlement("token")).toEqual(premium);
  });
});
