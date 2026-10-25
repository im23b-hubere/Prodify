import { renderHook } from "@testing-library/react-native";

import { usePaywallController } from "../../../features/paywall/usePaywallController";
import { usePaywallOfferings } from "../../../features/paywall/usePaywallOfferings";
import { usePremiumUpdateListener } from "../../../features/paywall/usePremiumUpdateListener";

let mockBusy = false;
let mockCachedPremium: boolean | null = null;
let mockProfileLoaded = true;
const mockRequestExitAfterUnlock = jest.fn();

jest.mock("expo-constants", () => ({ __esModule: true, default: { appOwnership: null } }));
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ source: "post_auth" }) }));
jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({
    token: "token",
    user: mockProfileLoaded ? { id: 1, is_premium: false } : null,
    userId: 1,
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    refreshUser: jest.fn(),
  }),
}));
jest.mock("../../../lib/e2eMode", () => ({ isE2eModeEnabled: () => false }));
jest.mock("../../../lib/billing", () => ({
  peekCachedHasPremiumAccess: () => mockCachedPremium,
  subscribeEntitlementCache: () => () => undefined,
}));
jest.mock("../../../features/profile/hooks/useProfileAccountActions", () => ({
  useProfileAccountActions: () => ({ confirmSignOut: jest.fn(), confirmDeleteAccount: jest.fn() }),
}));
jest.mock("../../../features/paywall/usePaywallCopy", () => ({
  usePaywallCopy: () => ({ copy: {}, previewWeeklyPrice: null, previewSixMonthPrice: null }),
}));
jest.mock("../../../features/paywall/usePaywallExit", () => ({
  usePaywallExit: () => ({
    requestExit: jest.fn(),
    requestExitAfterUnlock: mockRequestExitAfterUnlock,
    resolveExitAfterUnlock: () => "dashboard",
  }),
}));
jest.mock("../../../features/paywall/usePaywallOfferings", () => ({
  usePaywallOfferings: jest.fn(() => ({
    loading: false,
    error: null,
    purchaseEnabled: true,
    retry: jest.fn(),
  })),
}));
jest.mock("../../../features/paywall/usePaywallPurchases", () => ({
  usePaywallPurchases: () => ({
    busy: mockBusy,
    purchasePackage: jest.fn(),
    restore: jest.fn(),
    skipSubscriptionForDev: jest.fn(),
  }),
}));
jest.mock("../../../features/paywall/usePremiumUnlockFinalizer", () => ({
  usePremiumUnlockFinalizer: () => jest.fn(),
}));
jest.mock("../../../features/paywall/usePremiumUpdateListener", () => ({
  usePremiumUpdateListener: jest.fn(),
}));

describe("usePaywallController unlock ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBusy = false;
    mockCachedPremium = null;
    mockProfileLoaded = true;
  });

  it("asks billing about the signed-in account before its profile has loaded", () => {
    mockProfileLoaded = false;

    renderHook(() => usePaywallController());

    expect(usePaywallOfferings).toHaveBeenLastCalledWith(
      expect.objectContaining({ appUserId: "1" }),
    );
  });

  it("leaves the exit to a running purchase so its confirmation alert is shown", () => {
    mockBusy = true;
    mockCachedPremium = true;

    renderHook(() => usePaywallController());

    expect(mockRequestExitAfterUnlock).not.toHaveBeenCalled();
    expect(usePremiumUpdateListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("leaves quietly when premium arrives from outside a purchase", () => {
    mockCachedPremium = true;

    renderHook(() => usePaywallController());

    expect(mockRequestExitAfterUnlock).toHaveBeenCalledWith(false);
  });
});
