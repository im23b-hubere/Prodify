import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { AuthProvider, useAuth } from "../../context/AuthContext";
import { ApiError, apiJson, setApiUnauthorizedHandler } from "../../lib/client";
import { clearLocalAuthSession } from "../../lib/authSessionService";
import { readAccessToken } from "../../lib/authTokenStorage";

jest.mock("../../lib/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`api error ${status}`);
      this.status = status;
    }
  },
  apiJson: jest.fn(),
  setApiUnauthorizedHandler: jest.fn(),
  setAuthRefreshBridge: jest.fn(),
  warmApi: jest.fn(),
}));

jest.mock("../../lib/authTokenStorage", () => ({
  clearTokenPair: jest.fn().mockResolvedValue(undefined),
  readAccessToken: jest.fn(),
  readRefreshToken: jest.fn().mockResolvedValue(null),
  writeTokenPair: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/authSessionService", () => ({
  authenticate: jest.fn(),
  clearLocalAuthSession: jest.fn().mockResolvedValue(undefined),
  syncBillingInBackground: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/notificationInbox", () => ({
  setNotificationUserContext: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/onboardingGoalSync", () => ({
  syncPendingWeeklyGoal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/revenuecat", () => ({
  configureRevenueCat: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: () => false,
}));

jest.mock("../../lib/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const mockReadAccessToken = readAccessToken as jest.MockedFunction<typeof readAccessToken>;

const ACCOUNT = { id: 7, email: "producer@example.com", username: "producer" };

function renderAuth() {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    ),
  });
}

describe("AuthProvider user exposure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadAccessToken.mockResolvedValue("stored-token");
    mockApiJson.mockResolvedValue(ACCOUNT);
  });

  it("exposes the fetched account once a stored token is hydrated", async () => {
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.user).toEqual(ACCOUNT));
    expect(result.current.token).toBe("stored-token");
  });

  it("reports no user the moment the token goes away, without waiting for a refetch", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual(ACCOUNT));

    await act(async () => {
      await result.current.signOut();
    });

    expect(clearLocalAuthSession).toHaveBeenCalledWith(ACCOUNT.id, false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("keeps the user null when there was never a token to begin with", async () => {
    mockReadAccessToken.mockResolvedValue(null);

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.user).toBeNull();
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it("clears the full local session when the API reports unauthorized", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual(ACCOUNT));

    const handler = (setApiUnauthorizedHandler as jest.Mock).mock.calls
      .map((call) => call[0])
      .filter(Boolean)
      .at(-1) as () => Promise<void>;

    await act(async () => {
      await handler();
    });

    expect(clearLocalAuthSession).toHaveBeenCalledWith(ACCOUNT.id, false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("clears the full local session when /auth/me returns 401", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual(ACCOUNT));

    mockApiJson.mockRejectedValueOnce(new ApiError(401, "Unauthorized"));

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(clearLocalAuthSession).toHaveBeenCalledWith(ACCOUNT.id, false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
