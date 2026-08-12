import { act, render, waitFor } from "@testing-library/react-native";

import TabsLayout from "../../app/(tabs)/_layout";

let mockCachedAccess = false;
let mockRevision = 0;
let mockResolveAccess!: (value: boolean) => void;
let mockAccessPromise!: Promise<boolean>;
const mockListeners = new Set<() => void>();
const mockRedirect = jest.fn((_props: unknown) => null);

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockTabs = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: "tabs-layout" }, children);
  function MockTabScreen() {
    return null;
  }
  function MockRedirect(props: unknown) {
    return mockRedirect(props);
  }
  MockTabs.Screen = MockTabScreen;
  return {
    Redirect: MockRedirect,
    Tabs: MockTabs,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "token", user: { id: 1, is_premium: false }, hydrated: true }),
}));

jest.mock("../../hooks/useStreakReconcileOnForeground", () => ({
  useStreakReconcileOnForeground: jest.fn(),
}));

jest.mock("../../lib/billing", () => ({
  getEntitlementCacheRevision: () => mockRevision,
  peekCachedHasPremiumAccess: () => mockCachedAccess,
  peekStoredHasPremiumAccess: jest.fn().mockResolvedValue(false),
  subscribeEntitlementCache: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
}));

jest.mock("../../lib/devBillingBypass", () => ({
  isDevBillingBypassActive: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../lib/e2eMode", () => ({ isE2eModeEnabled: () => false }));
jest.mock("../../lib/premiumAccess", () => ({
  resolvePremiumAccess: () => mockAccessPromise,
}));

jest.mock("../../components/brand/ProdifyWordmark", () => ({
  ProdifyWordmark: () => null,
}));

describe("TabsLayout entitlement updates", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCachedAccess = false;
    mockRevision = 0;
    mockAccessPromise = new Promise((resolve) => {
      mockResolveAccess = resolve;
    });
    mockListeners.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("does not redirect a cached free user before the authoritative check finishes", async () => {
    const screen = render(<TabsLayout />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRedirect).not.toHaveBeenCalled();

    act(() => mockResolveAccess(true));
    await waitFor(() => expect(screen.getByTestId("tabs-layout")).toBeTruthy());
  });

  it("opens the tabs when the paywall seeds premium access", async () => {
    const screen = render(<TabsLayout />);

    act(() => {
      mockCachedAccess = true;
      mockRevision += 1;
      mockListeners.forEach((listener) => listener());
    });

    await waitFor(() => expect(screen.getByTestId("tabs-layout")).toBeTruthy());
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects only after the authoritative check confirms free access", async () => {
    render(<TabsLayout />);

    act(() => mockResolveAccess(false));

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledTimes(1));
  });
});
