import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { ONBOARDING_COMPLETE_KEY } from "../../../constants/storageKeys";
import { usePasswordResetForm } from "../../../features/auth/hooks/usePasswordResetForm";
import { requestPasswordResetCode } from "../../../features/auth/passwordResetApi";
import { ApiError } from "../../../lib/client";
import { replaceWithPendingDeepLinkOrDashboard } from "../../../lib/pendingDeepLink";

const mockResetPassword = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { email?: string } = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ resetPassword: mockResetPassword }),
}));

jest.mock("../../../features/auth/passwordResetApi", () => ({
  requestPasswordResetCode: jest.fn(),
}));

jest.mock("../../../lib/pendingDeepLink", () => ({
  replaceWithPendingDeepLinkOrDashboard: jest.fn().mockResolvedValue(undefined),
}));

const t = ((key: string) => key) as TFunction;
const mockRequestCode = requestPasswordResetCode as jest.Mock;

type Form = { current: ReturnType<typeof usePasswordResetForm> };

async function sendCodeFor(result: Form, email = "user@example.com") {
  act(() => result.current.setEmail(email));
  await act(async () => {
    await result.current.sendCode();
  });
}

async function submitReset(result: Form, code = "123456", password = "new-password") {
  act(() => {
    result.current.setCode(code);
    result.current.setNewPassword(password);
  });
  await act(async () => {
    await result.current.submit();
  });
}

describe("usePasswordResetForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockRequestCode.mockResolvedValue(undefined);
    mockResetPassword.mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("1");
  });

  it("starts with the email typed on the sign-in screen", () => {
    mockParams = { email: "typed@example.com" };

    const { result } = renderHook(() => usePasswordResetForm(t));

    expect(result.current.email).toBe("typed@example.com");
    expect(result.current.step).toBe("email");
  });

  it("requests a code and moves on to entering it", async () => {
    const { result } = renderHook(() => usePasswordResetForm(t));

    await sendCodeFor(result, " user@example.com ");

    expect(mockRequestCode).toHaveBeenCalledWith("user@example.com");
    expect(result.current.step).toBe("code");
    expect(result.current.error).toBeNull();
  });

  it("does not request a code for an invalid address", async () => {
    const { result } = renderHook(() => usePasswordResetForm(t));

    await sendCodeFor(result, "producer");

    expect(mockRequestCode).not.toHaveBeenCalled();
    expect(result.current.step).toBe("email");
    expect(result.current.error).toBe("errors.validation.email");
  });

  it("stays on the email step when the request fails", async () => {
    mockRequestCode.mockRejectedValue(new ApiError(429, "Too many requests"));
    const { result } = renderHook(() => usePasswordResetForm(t));

    await sendCodeFor(result);

    expect(result.current.step).toBe("email");
    expect(result.current.error).toBe("errors.tooManyRequests");
  });

  it("resets the password, remembers onboarding as done and continues into the app", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => usePasswordResetForm(t));
    await sendCodeFor(result);

    await submitReset(result, " 123456 ");

    expect(mockResetPassword).toHaveBeenCalledWith("user@example.com", "123456", "new-password");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY, "1");
  });

  it("opens the dashboard after a reset when onboarding was already done", async () => {
    const { result } = renderHook(() => usePasswordResetForm(t));
    await sendCodeFor(result);

    await submitReset(result);

    expect(replaceWithPendingDeepLinkOrDashboard).toHaveBeenCalledTimes(1);
  });

  it("explains a wrong or expired code and stays on the form", async () => {
    mockResetPassword.mockRejectedValue(new ApiError(400, "ignored", null, "RESET_CODE_INVALID"));
    const { result } = renderHook(() => usePasswordResetForm(t));
    await sendCodeFor(result);

    await submitReset(result);

    expect(result.current.error).toBe("errors.auth.resetCodeInvalid");
    expect(result.current.step).toBe("code");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(replaceWithPendingDeepLinkOrDashboard).not.toHaveBeenCalled();
  });

  it("validates the code before calling the server", async () => {
    const { result } = renderHook(() => usePasswordResetForm(t));
    await sendCodeFor(result);

    await submitReset(result, "12");

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(result.current.error).toBe("errors.validation.codeInvalid");
  });

  it("goes back to the email step and forgets the typed code", async () => {
    const { result } = renderHook(() => usePasswordResetForm(t));
    await sendCodeFor(result);
    act(() => result.current.setCode("123456"));

    act(() => result.current.changeEmail());

    expect(result.current.step).toBe("email");
    expect(result.current.code).toBe("");
  });
});
