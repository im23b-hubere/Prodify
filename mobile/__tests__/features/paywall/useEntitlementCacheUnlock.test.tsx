import { renderHook } from "@testing-library/react-native";

import { useEntitlementCacheUnlock } from "../../../features/paywall/useEntitlementCacheUnlock";
import { peekCachedHasPremiumAccess, subscribeEntitlementCache } from "../../../lib/billing";

jest.mock("../../../lib/billing", () => ({
  peekCachedHasPremiumAccess: jest.fn(() => null),
  subscribeEntitlementCache: jest.fn(() => jest.fn()),
}));

const mockPeek = peekCachedHasPremiumAccess as jest.MockedFunction<typeof peekCachedHasPremiumAccess>;
const mockSubscribe = subscribeEntitlementCache as jest.MockedFunction<typeof subscribeEntitlementCache>;

function emitCacheChange() {
  const listener = mockSubscribe.mock.calls.at(-1)?.[0];
  listener?.();
}

describe("useEntitlementCacheUnlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockImplementation(() => jest.fn());
  });

  it("leaves the paywall once the cache becomes premium for this token", () => {
    const onPremium = jest.fn();
    mockPeek.mockReturnValue(null);
    renderHook(() => useEntitlementCacheUnlock({ token: "token", enabled: true, onPremium }));

    mockPeek.mockReturnValue(true);
    emitCacheChange();
    emitCacheChange();

    expect(onPremium).toHaveBeenCalledTimes(1);
  });

  it("stays when a cache update is not premium", () => {
    const onPremium = jest.fn();
    mockPeek.mockReturnValue(false);
    renderHook(() => useEntitlementCacheUnlock({ token: "token", enabled: true, onPremium }));

    emitCacheChange();

    expect(onPremium).not.toHaveBeenCalled();
  });

  it("leaves immediately when premium was cached before the paywall subscribed", () => {
    const onPremium = jest.fn();
    mockPeek.mockReturnValue(true);

    renderHook(() => useEntitlementCacheUnlock({ token: "token", enabled: true, onPremium }));

    expect(onPremium).toHaveBeenCalledTimes(1);
  });

  it("does not watch the cache while disabled", () => {
    renderHook(() =>
      useEntitlementCacheUnlock({ token: "token", enabled: false, onPremium: jest.fn() }),
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockPeek).not.toHaveBeenCalled();
  });
});