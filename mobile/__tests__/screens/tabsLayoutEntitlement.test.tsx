import { act, render, waitFor } from "@testing-library/react-native";

import TabsLayout from "../../app/(tabs)/_layout";

let mockCachedAccess = false;
let mockIsPremium = false;
let mockRevision = 0;
let mockResolveAccess!: (value: boolean) => void;
let mockRejectAccess!: (reason: Error) => void;
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
    DarkTheme: { dark: true, colors: {} },
    Redirect: MockRedirect,
    Tabs: MockTabs,
    ThemeProvider: ({ children }: { children?: React.ReactNode }) => children,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    token: "token",
    user: { id: 1, is_premium: mockIsPremium },
    hydrated: true,
  }),
}));

jest.mock("../../hooks/useStreakForegroundSync", () => ({
  useStreakForegroundSync: jest.fn(),
}));

jest.mock("../../hooks/useAppOpenReporting", () => ({
  useAppOpenReporting: jest.fn(),
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
  isExpoGoDevRuntime: () => false,
  isDevBillingBypassActive: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../lib/e2eMode", () => ({ isE2eModeEnabled: () => false }));
jest.mock("../../lib/premiumAccess", () => ({
  resolvePremiumAccess: () => mockAccessPromise,
}));

jest.mock("../../components/brand/ProdifyWordmark", () => ({
  ProdifyWordmark: () => null,
}));

jest.mock("../../features/navigation/MainTabs", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    MainTabs: () => React.createElement(View, { testID: "tabs-layout" }),
  };
});

describe("TabsLayout entitlement updates", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCachedAccess = false;
    mockIsPremium = false;
    mockRevision = 0;
    mockAccessPromise = new Promise((resolve, reject) => {
      mockResolveAccess = resolve;
      mockRejectAccess = reject;
    });
    mockListeners.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("does not redirect a cached unsubscribed user before the authoritative check finishes", async () => {
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

  it("redirects only after the authoritative check confirms no active subscription", async () => {
    render(<TabsLayout />);

    act(() => mockResolveAccess(false));

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledTimes(1));
  });

  it("opens the app when premium arrives after the boot wait has already shown the paywall", async () => {
    const screen = render(<TabsLayout />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRedirect).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("tabs-layout")).toBeNull();

    await act(async () => {
      mockResolveAccess(true);
    });

    await waitFor(() => expect(screen.getByTestId("tabs-layout")).toBeTruthy());
  });

  it("keeps the paywall when the check finishes without a subscription", async () => {
    const screen = render(<TabsLayout />);

    await act(async () => {
      mockResolveAccess(false);
    });

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledTimes(1));
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByTestId("tabs-layout")).toBeNull();
  });

  it("does not show the paywall for a premium profile when the timer fires first", async () => {
    mockIsPremium = true;
    const screen = render(<TabsLayout />);

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByTestId("tabs-layout")).toBeTruthy();
  });

  it("shows the paywall instead of spinning forever when the check never answers", async () => {
    const screen = render(<TabsLayout />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRedirect).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("tabs-layout")).toBeNull();
  });

  it("shows the paywall when the check throws", async () => {
    const screen = render(<TabsLayout />);

    await act(async () => {
      mockRejectAccess(new Error("billing down"));
    });

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("tabs-layout")).toBeNull();
  });
});
