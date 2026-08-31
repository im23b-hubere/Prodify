import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { ONBOARDING_COMPLETE_KEY } from "../../../constants/storageKeys";
import { useLoginForm } from "../../../features/auth/hooks/useLoginForm";
import { replaceWithPendingDeepLinkOrDashboard } from "../../../lib/pendingDeepLink";

const mockSignIn = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: { next?: string; variant?: string; source?: string } = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

jest.mock("../../../lib/e2eCredentials", () => ({
  getE2eTestCredentials: () => null,
}));

jest.mock("../../../lib/e2eMode", () => ({
  isE2eModeEnabled: () => false,
}));

jest.mock("../../../lib/pendingDeepLink", () => ({
  replaceWithPendingDeepLinkOrDashboard: jest.fn().mockResolvedValue(undefined),
}));

const t = ((key: string) => key) as TFunction;

async function submitLogin(
  result: { current: ReturnType<typeof useLoginForm> },
  email = "user@example.com",
  password = "secret",
) {
  act(() => {
    result.current.setEmail(email);
    result.current.setPassword(password);
  });
  await act(async () => {
    await result.current.submit();
  });
}

function onboardingCompleteWrites(): unknown[][] {
  return (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([key]) => key === ONBOARDING_COMPLETE_KEY,
  );
}

describe("useLoginForm existing-account onboarding path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockSignIn.mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it("persists onboarding complete and continues to paywall after existing-account login", async () => {
    mockParams = { next: "paywall", source: "existing_account", variant: "value" };
    const { result } = renderHook(() => useLoginForm(t));

    await submitLogin(result);

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret");
    expect(onboardingCompleteWrites()).toEqual([[ONBOARDING_COMPLETE_KEY, "1"]]);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/paywall",
      params: { source: "post_auth", variant: "value" },
    });
    expect(replaceWithPendingDeepLinkOrDashboard).not.toHaveBeenCalled();
  });

  it("does not persist onboarding complete when existing-account login fails", async () => {
    mockParams = { next: "paywall", source: "existing_account", variant: "value" };
    mockSignIn.mockRejectedValue(new Error("Invalid credentials"));
    const { result } = renderHook(() => useLoginForm(t));

    await submitLogin(result);

    expect(mockSignIn).toHaveBeenCalled();
    expect(onboardingCompleteWrites()).toEqual([]);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Invalid credentials");
  });

  it("does not persist onboarding complete for ordinary login", async () => {
    const { result } = renderHook(() => useLoginForm(t));

    await submitLogin(result);

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret");
    expect(onboardingCompleteWrites()).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    expect(replaceWithPendingDeepLinkOrDashboard).not.toHaveBeenCalled();
  });

  it("does not persist onboarding complete for paywall login that is not existing-account", async () => {
    mockParams = { next: "paywall", source: "onboarding", variant: "outcome" };
    const { result } = renderHook(() => useLoginForm(t));

    await submitLogin(result);

    expect(onboardingCompleteWrites()).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/paywall",
      params: { source: "post_auth", variant: "outcome" },
    });
  });

  it("keeps ordinary dashboard login when onboarding was already completed", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("1");
    const { result } = renderHook(() => useLoginForm(t));

    await submitLogin(result);

    expect(onboardingCompleteWrites()).toEqual([]);
    expect(replaceWithPendingDeepLinkOrDashboard).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
