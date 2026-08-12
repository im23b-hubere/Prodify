import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { usePaywallExit } from "../../../features/paywall/usePaywallExit";
import { replaceWithPendingDeepLinkOrDashboard } from "../../../lib/pendingDeepLink";

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../lib/pendingDeepLink", () => ({
  replaceWithPendingDeepLinkOrDashboard: jest.fn().mockResolvedValue(undefined),
}));

const mockReplaceWithDashboard = replaceWithPendingDeepLinkOrDashboard as jest.MockedFunction<
  typeof replaceWithPendingDeepLinkOrDashboard
>;

describe("usePaywallExit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("completes an automatic premium exit once without showing a startup alert", async () => {
    const { result } = renderHook(() => usePaywallExit("post_auth", true));

    act(() => {
      result.current.requestExitAfterUnlock();
      result.current.requestExitAfterUnlock();
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(mockReplaceWithDashboard).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows confirmation after a user-triggered purchase or restore", async () => {
    const { result } = renderHook(() => usePaywallExit("post_auth", true));

    act(() => {
      result.current.requestExitAfterUnlock(true);
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "paywall.alerts.premiumUnlockedTitle",
      "paywall.alerts.premiumUnlockedBody",
    );
  });
});
