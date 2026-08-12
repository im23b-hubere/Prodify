import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { syncEntitlement } from "../../../lib/billing";
import {
  getRevenueCatCustomerInfo,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../../../lib/revenuecat";
import { usePaywallPurchases } from "../../../features/paywall/usePaywallPurchases";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../lib/billing", () => ({
  seedEntitlementCache: jest.fn(),
  syncEntitlement: jest.fn(),
}));

jest.mock("../../../lib/devBillingBypass", () => ({
  setDevBillingBypass: jest.fn(),
}));

jest.mock("../../../lib/revenuecat", () => ({
  activeEntitlementExpiration: jest.fn(() => "2030-01-01T00:00:00.000Z"),
  getRevenueCatCustomerInfo: jest.fn(),
  isPremiumActive: jest.fn((info: { entitlements?: { active?: Record<string, unknown> } }) =>
    Boolean(info.entitlements?.active?.app_access),
  ),
  purchaseRevenueCatPackage: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}));

const ACTIVE_CUSTOMER = {
  entitlements: { active: { app_access: { expirationDate: "2030-01-01T00:00:00.000Z" } } },
};
const INACTIVE_CUSTOMER = { entitlements: { active: {} } };
const PACKAGE = { identifier: "$rc_weekly" };

function renderPurchases() {
  const finalizeUnlock = jest.fn().mockResolvedValue(undefined);
  const refreshUser = jest.fn().mockResolvedValue(undefined);
  const requestExit = jest.fn();
  const hook = renderHook(() =>
    usePaywallPurchases({
      token: "token",
      appUserId: "42",
      previewMode: false,
      finalizeUnlock,
      refreshUser,
      requestExit,
      resolveExitAfterUnlock: () => "dashboard",
    }),
  );
  return { ...hook, finalizeUnlock, refreshUser, requestExit };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  (syncEntitlement as jest.Mock).mockResolvedValue({ entitlement: "premium" });
});

it("finalizes a purchase only after RevenueCat reports the premium entitlement", async () => {
  (purchaseRevenueCatPackage as jest.Mock).mockResolvedValue({ customerInfo: ACTIVE_CUSTOMER });
  const { result, finalizeUnlock } = renderPurchases();

  await act(async () => {
    await result.current.purchasePackage(PACKAGE as never);
  });

  expect(finalizeUnlock).toHaveBeenCalledWith(ACTIVE_CUSTOMER, undefined, true);
  expect(result.current.busy).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
});

it("treats an App Store cancellation as a neutral outcome", async () => {
  (purchaseRevenueCatPackage as jest.Mock).mockRejectedValue({ userCancelled: true });
  const { result, finalizeUnlock } = renderPurchases();

  await act(async () => {
    await result.current.purchasePackage(PACKAGE as never);
  });

  expect(finalizeUnlock).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
});

it("recovers an already-owned subscription before reporting a failure", async () => {
  (purchaseRevenueCatPackage as jest.Mock).mockRejectedValue({
    code: "PRODUCT_ALREADY_PURCHASED",
  });
  (getRevenueCatCustomerInfo as jest.Mock).mockResolvedValue(ACTIVE_CUSTOMER);
  const { result, finalizeUnlock } = renderPurchases();

  await act(async () => {
    await result.current.purchasePackage(PACKAGE as never);
  });

  expect(finalizeUnlock).toHaveBeenCalledWith(ACTIVE_CUSTOMER, undefined, true);
  expect(restoreRevenueCatPurchases).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it("syncs and unlocks a restored premium subscription", async () => {
  (restoreRevenueCatPurchases as jest.Mock).mockResolvedValue(ACTIVE_CUSTOMER);
  const { result, finalizeUnlock, refreshUser } = renderPurchases();

  await act(async () => {
    await result.current.restore();
  });

  expect(syncEntitlement).toHaveBeenCalledWith("token", {
    app_user_id: "42",
    entitlement: "premium",
    trial_active: false,
    expires_at: "2030-01-01T00:00:00.000Z",
  });
  expect(refreshUser).toHaveBeenCalled();
  expect(finalizeUnlock).toHaveBeenCalledWith(ACTIVE_CUSTOMER, undefined, true);
  expect(result.current.busy).toBe(false);
});

it("reports a completed restore when no subscription is active", async () => {
  (restoreRevenueCatPurchases as jest.Mock).mockResolvedValue(INACTIVE_CUSTOMER);
  const { result, finalizeUnlock } = renderPurchases();

  await act(async () => {
    await result.current.restore();
  });

  expect(finalizeUnlock).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    "paywall.alerts.restoreCompleteTitle",
    "paywall.alerts.restoreCompleteNone",
  );
});
