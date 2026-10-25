import { act, renderHook } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { useProfileAccountActions } from "../../../features/profile/hooks/useProfileAccountActions";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Confirms the alert that is open, as if the user tapped its destructive button. */
async function confirmAlert() {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[];
  const destructive = buttons.find((button) => button.style === "destructive");
  await act(async () => {
    destructive?.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useProfileAccountActions", () => {
  const signOut = jest.fn().mockResolvedValue(undefined);
  const deleteAccount = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns to login after signing out by default", async () => {
    const { result } = renderHook(() => useProfileAccountActions({ signOut, deleteAccount }));

    result.current.confirmSignOut();
    await confirmAlert();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("lets the caller decide where to go after signing out", async () => {
    const afterSessionEnds = jest.fn();
    const { result } = renderHook(() =>
      useProfileAccountActions({ signOut, deleteAccount, afterSessionEnds }),
    );

    result.current.confirmSignOut();
    await confirmAlert();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(afterSessionEnds).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("lets the caller decide where to go after deleting the account", async () => {
    const afterSessionEnds = jest.fn();
    const { result } = renderHook(() =>
      useProfileAccountActions({ signOut, deleteAccount, afterSessionEnds }),
    );

    result.current.confirmDeleteAccount();
    await confirmAlert();

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(afterSessionEnds).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
