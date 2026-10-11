import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { useSocialSignIn } from "../../../features/auth/hooks/useSocialSignIn";
import { ApiError } from "../../../lib/client";
import { requestAppleCredential, requestGoogleIdToken } from "../../../lib/socialSignIn";

const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();

jest.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ signInWithApple: mockSignInWithApple, signInWithGoogle: mockSignInWithGoogle }),
}));

jest.mock("../../../lib/socialSignIn", () => ({
  isAppleSignInAvailable: jest.fn().mockResolvedValue(true),
  isGoogleSignInAvailable: jest.fn().mockReturnValue(true),
  requestAppleCredential: jest.fn(),
  requestGoogleIdToken: jest.fn(),
}));

const t = ((key: string) => key) as TFunction;
const appleCredential = { identityToken: "apple-token", authorizationCode: "code", givenName: "Kenny" };

function renderSocialSignIn(onSignedIn = jest.fn()) {
  const rendered = renderHook(() => useSocialSignIn({ t, onSignedIn }));
  return { ...rendered, onSignedIn };
}

describe("useSocialSignIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithApple.mockResolvedValue(undefined);
    mockSignInWithGoogle.mockResolvedValue(undefined);
  });

  it("exposes the providers this device supports", async () => {
    const { result } = renderSocialSignIn();

    await waitFor(() => expect(result.current.isAppleAvailable).toBe(true));
    expect(result.current.isGoogleAvailable).toBe(true);
  });

  it("signs in with the Apple credential and then hands over navigation", async () => {
    (requestAppleCredential as jest.Mock).mockResolvedValue({ status: "success", credential: appleCredential });
    const { result, onSignedIn } = renderSocialSignIn();

    await act(async () => {
      await result.current.continueWithApple();
    });

    expect(mockSignInWithApple).toHaveBeenCalledWith(appleCredential);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(result.current.pendingProvider).toBeNull();
  });

  it("treats a dismissed Google sheet as a silent no-op", async () => {
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ status: "cancelled" });
    const { result, onSignedIn } = renderSocialSignIn();

    await act(async () => {
      await result.current.continueWithGoogle();
    });

    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("shows the mapped backend error and stays on the screen when the server rejects", async () => {
    (requestGoogleIdToken as jest.Mock).mockResolvedValue({ status: "success", credential: "google-token" });
    mockSignInWithGoogle.mockRejectedValue(new ApiError(401, "ignored", null, "SOCIAL_TOKEN_INVALID"));
    const { result, onSignedIn } = renderSocialSignIn();

    await act(async () => {
      await result.current.continueWithGoogle();
    });

    expect(onSignedIn).not.toHaveBeenCalled();
    expect(result.current.error).toBe("errors.auth.socialTokenInvalid");
  });
});
