import { renderHook } from "@testing-library/react-native";

import { usePremiumUpdateListener } from "../../../features/paywall/usePremiumUpdateListener";
import { subscribeToCustomerInfoUpdates } from "../../../lib/revenuecat";

const mockUnsubscribe = jest.fn();

jest.mock("../../../lib/revenuecat", () => ({
  subscribeToCustomerInfoUpdates: jest.fn(() => mockUnsubscribe),
  isPremiumActive: (info: { entitlements: { active: Record<string, unknown> } }) =>
    Boolean(info.entitlements.active.app_access),
}));

const mockSubscribe = subscribeToCustomerInfoUpdates as jest.MockedFunction<
  typeof subscribeToCustomerInfoUpdates
>;

const premiumInfo = { entitlements: { active: { app_access: {} } } };
const inactiveInfo = { entitlements: { active: {} } };

function emitCustomerInfo(info: unknown) {
  const listener = mockSubscribe.mock.calls.at(-1)?.[0];
  listener?.(info as never);
}

describe("usePremiumUpdateListener", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("unlocks once when RevenueCat reports access after the paywall opened", () => {
    const onPremium = jest.fn();
    renderHook(() => usePremiumUpdateListener({ enabled: true, onPremium }));

    emitCustomerInfo(premiumInfo);
    emitCustomerInfo(premiumInfo);

    expect(onPremium).toHaveBeenCalledTimes(1);
    expect(onPremium).toHaveBeenCalledWith(premiumInfo);
  });

  it("ignores updates without access", () => {
    const onPremium = jest.fn();
    renderHook(() => usePremiumUpdateListener({ enabled: true, onPremium }));

    emitCustomerInfo(inactiveInfo);

    expect(onPremium).not.toHaveBeenCalled();
  });

  it("stays silent while a purchase or restore owns the unlock", () => {
    const onPremium = jest.fn();
    renderHook(() => usePremiumUpdateListener({ enabled: false, onPremium }));

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("stops listening when the paywall closes", () => {
    const { unmount } = renderHook(() =>
      usePremiumUpdateListener({ enabled: true, onPremium: jest.fn() }),
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
