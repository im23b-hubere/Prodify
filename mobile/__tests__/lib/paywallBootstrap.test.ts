import type { TFunction } from "i18next";

import { bootstrapPaywall } from "../../lib/paywallBootstrap";
import { resolvePremiumGrant } from "../../lib/premiumAccess";
import {
  getPaywallBillingSnapshot,
  getRevenueCatCustomerInfo,
  restoreRevenueCatPurchases,
} from "../../lib/revenuecat";

jest.mock("../../lib/premiumAccess", () => ({
  resolvePremiumGrant: jest.fn(),
}));

jest.mock("../../lib/revenuecat", () => ({
  getPaywallBillingSnapshot: jest.fn(),
  getRevenueCatCustomerInfo: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
  isPremiumActive: (info: { entitlements?: { active?: Record<string, unknown> } }) =>
    Boolean(info?.entitlements?.active?.app_access),
}));

const t = ((key: string) => key) as TFunction;

function makePackage(productId: string, priceString: string) {
  return {
    identifier: "$rc_weekly",
    packageType: "WEEKLY",
    product: { identifier: productId, priceString, price: 7.9 },
  };
}

describe("bootstrapPaywall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns premium_unlock when the server entitlement is active", async () => {
    (resolvePremiumGrant as jest.Mock).mockResolvedValue({
      source: "entitlement",
      entitlement: { entitlement: "premium" },
    });
    (getPaywallBillingSnapshot as jest.Mock).mockResolvedValue({
      customerInfo: null,
      offering: null,
    });

    await expect(
      bootstrapPaywall({ token: "tok", appUserId: "1", t }),
    ).resolves.toEqual({
      kind: "premium_unlock",
      customerInfo: null,
    });
    expect(resolvePremiumGrant).toHaveBeenCalledWith("tok", "1", undefined, {
      includeRevenueCat: false,
    });
  });

  it("returns premium_unlock from the single RevenueCat customer snapshot", async () => {
    (resolvePremiumGrant as jest.Mock).mockResolvedValue(null);
    const customerInfo = { entitlements: { active: { app_access: {} } } };
    (getPaywallBillingSnapshot as jest.Mock).mockResolvedValue({
      customerInfo,
      offering: { availablePackages: [] },
    });

    await expect(
      bootstrapPaywall({ token: "tok", appUserId: "1", t }),
    ).resolves.toEqual({ kind: "premium_unlock", customerInfo });
  });

  it("returns plans_ready when offerings include purchasable packages", async () => {
    (resolvePremiumGrant as jest.Mock).mockResolvedValue(null);
    const weekly = makePackage("prodify_weekly_access", "CHF 7.90");
    (getPaywallBillingSnapshot as jest.Mock).mockResolvedValue({
      customerInfo: null,
      offering: { availablePackages: [weekly] },
    });

    const result = await bootstrapPaywall({ token: "tok", appUserId: "1", t });
    expect(result.kind).toBe("plans_ready");
    if (result.kind === "plans_ready") {
      expect(result.weekly).toEqual(weekly);
      expect(result.purchasable).toHaveLength(1);
    }
  });

  it("auto-restores an existing subscription when offerings are empty", async () => {
    (resolvePremiumGrant as jest.Mock).mockResolvedValue(null);
    (getPaywallBillingSnapshot as jest.Mock).mockResolvedValue({
      customerInfo: null,
      offering: { availablePackages: [] },
    });
    (getRevenueCatCustomerInfo as jest.Mock).mockResolvedValue({
      entitlements: { active: {} },
    });
    (restoreRevenueCatPurchases as jest.Mock).mockResolvedValue({
      entitlements: { active: { app_access: {} } },
    });

    await expect(
      bootstrapPaywall({ token: "tok", appUserId: "1", t }),
    ).resolves.toEqual({
      kind: "premium_unlock",
      customerInfo: { entitlements: { active: { app_access: {} } } },
    });
  });
});
