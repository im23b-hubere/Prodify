import Purchases from "react-native-purchases";

import { purchaseRevenueCatPackage } from "../../lib/revenuecat";

jest.mock("../../constants/env", () => ({
  getExpoPublicRevenueCatApiKey: () => "appl_test_key",
  getExpoPublicRevenueCatEntitlementId: () => "app_access",
}));

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: () => false,
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    LOG_LEVEL: { DEBUG: "DEBUG" },
    configure: jest.fn(),
    getOfferings: jest.fn(),
    getCustomerInfo: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    setLogLevel: jest.fn(),
  },
}));

describe("purchaseRevenueCatPackage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps purchases associated with the authenticated RevenueCat app user id", async () => {
    const customerInfo = { entitlements: { active: { app_access: {} } } };
    (Purchases.purchasePackage as jest.Mock).mockResolvedValue({ customerInfo });

    const pkg = { identifier: "$rc_weekly", product: { identifier: "prodify_weekly_access" } };

    await expect(purchaseRevenueCatPackage(pkg as never, "42")).resolves.toEqual({
      customerInfo,
    });

    expect(Purchases.configure).toHaveBeenCalledWith({
      apiKey: "appl_test_key",
      appUserID: "42",
    });
    expect(Purchases.purchasePackage).toHaveBeenCalledWith(pkg);
  });
});
