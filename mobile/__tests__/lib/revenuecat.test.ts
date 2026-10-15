import type PurchasesType from "react-native-purchases";

import type * as RevenueCatModule from "../../lib/revenuecat";

jest.mock("../../constants/env", () => ({
  getExpoPublicRevenueCatApiKey: () => "appl_test_key",
  getExpoPublicRevenueCatEntitlementId: () => "app_access",
}));

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: () => false,
}));

jest.mock("expo-constants", () => ({
  appOwnership: null,
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    LOG_LEVEL: { DEBUG: "DEBUG" },
    configure: jest.fn(),
    getAppUserID: jest.fn(),
    getOfferings: jest.fn(),
    getCustomerInfo: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}));

const premiumInfo = { entitlements: { active: { app_access: {} } } };

/** The module keeps SDK session state, so every test starts from a fresh app process. */
function loadRevenueCat(sdkAppUserId: string) {
  let revenueCat!: typeof RevenueCatModule;
  let purchases!: jest.Mocked<typeof PurchasesType>;
  jest.isolateModules(() => {
    revenueCat = require("../../lib/revenuecat");
    purchases = require("react-native-purchases").default;
  });
  purchases.getAppUserID.mockResolvedValue(sdkAppUserId);
  purchases.logIn.mockResolvedValue({ customerInfo: premiumInfo, created: false } as never);
  return { revenueCat, purchases };
}

describe("purchaseRevenueCatPackage", () => {
  it("keeps purchases associated with the authenticated RevenueCat app user id", async () => {
    const { revenueCat, purchases } = loadRevenueCat("42");
    purchases.purchasePackage.mockResolvedValue({ customerInfo: premiumInfo } as never);
    const pkg = { identifier: "$rc_weekly", product: { identifier: "prodify_weekly_access" } };

    await expect(revenueCat.purchaseRevenueCatPackage(pkg as never, "42")).resolves.toEqual({
      customerInfo: premiumInfo,
    });

    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: "appl_test_key", appUserID: "42" });
    expect(purchases.purchasePackage).toHaveBeenCalledWith(pkg);
  });

  it("refuses to purchase while the SDK is still signed in as someone else", async () => {
    const { revenueCat, purchases } = loadRevenueCat("$RCAnonymousID:previous");
    const pkg = { identifier: "$rc_weekly", product: { identifier: "prodify_weekly_access" } };

    await expect(revenueCat.purchaseRevenueCatPackage(pkg as never, "42")).rejects.toThrow();

    expect(purchases.purchasePackage).not.toHaveBeenCalled();
  });
});

describe("getRevenueCatCustomerInfo", () => {
  it("reads customer info once the SDK is signed in as the requested user", async () => {
    const { revenueCat, purchases } = loadRevenueCat("42");
    purchases.getCustomerInfo.mockResolvedValue(premiumInfo as never);

    await expect(revenueCat.getRevenueCatCustomerInfo("42")).resolves.toBe(premiumInfo);
  });

  it("refuses to read another customer's info while the SDK identity lags behind", async () => {
    const { revenueCat, purchases } = loadRevenueCat("$RCAnonymousID:previous");
    purchases.getCustomerInfo.mockResolvedValue(premiumInfo as never);

    await expect(revenueCat.getRevenueCatCustomerInfo("42")).rejects.toThrow();

    expect(purchases.getCustomerInfo).not.toHaveBeenCalled();
  });
});

describe("restoreRevenueCatPurchases", () => {
  it("refuses to restore into another customer while the SDK identity lags behind", async () => {
    const { revenueCat, purchases } = loadRevenueCat("$RCAnonymousID:previous");

    await expect(revenueCat.restoreRevenueCatPurchases("42")).rejects.toThrow();

    expect(purchases.restorePurchases).not.toHaveBeenCalled();
  });
});

describe("getDefaultOffering", () => {
  it("loads offerings even before the SDK identity is confirmed", async () => {
    const { revenueCat, purchases } = loadRevenueCat("$RCAnonymousID:previous");
    const offering = { identifier: "default", availablePackages: [] };
    purchases.getOfferings.mockResolvedValue({ current: offering, all: {} } as never);

    await expect(revenueCat.getDefaultOffering("42")).resolves.toBe(offering);
  });
});

describe("isPremiumActive", () => {
  it("grants access for the configured entitlement", () => {
    const { revenueCat } = loadRevenueCat("42");

    expect(revenueCat.isPremiumActive(premiumInfo as never)).toBe(true);
  });

  it("does not grant access for a differently named entitlement", () => {
    const { revenueCat } = loadRevenueCat("42");

    expect(
      revenueCat.isPremiumActive({ entitlements: { active: { premium: {} } } } as never),
    ).toBe(false);
  });
});

describe("subscribeToCustomerInfoUpdates", () => {
  it("forwards customer info updates until unsubscribed", async () => {
    const { revenueCat, purchases } = loadRevenueCat("42");
    await revenueCat.configureRevenueCat("42");
    const onUpdate = jest.fn();

    const unsubscribe = revenueCat.subscribeToCustomerInfoUpdates(onUpdate);
    const registered = purchases.addCustomerInfoUpdateListener.mock.calls[0][0];
    registered(premiumInfo as never);
    unsubscribe();

    expect(onUpdate).toHaveBeenCalledWith(premiumInfo);
    expect(purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(registered);
  });

  it("does nothing before the SDK is configured", () => {
    const { revenueCat, purchases } = loadRevenueCat("42");

    const unsubscribe = revenueCat.subscribeToCustomerInfoUpdates(jest.fn());
    unsubscribe();

    expect(purchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
  });
});
