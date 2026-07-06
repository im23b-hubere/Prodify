import AsyncStorage from "@react-native-async-storage/async-storage";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";
import {
  DASHBOARD_TAB_HREF,
  getPostLoginHref,
  POST_REGISTER_HREF,
  resolvePostAuthRoute,
  resolveUnauthenticatedAuthHref,
} from "../lib/postAuthNavigation";

jest.mock("../lib/e2eMode", () => ({
  isE2eModeEnabled: jest.fn(() => false),
}));

import { isE2eModeEnabled } from "../lib/e2eMode";

describe("postAuthNavigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports a fixed post-register route", () => {
    expect(POST_REGISTER_HREF).toBe("/onboarding");
  });

  it("exports dashboard tab href", () => {
    expect(DASHBOARD_TAB_HREF).toBe("/(tabs)/dashboard");
  });

  it("resolveUnauthenticatedAuthHref sends onboarded users to login", () => {
    expect(resolveUnauthenticatedAuthHref(true)).toBe("/(auth)/login");
    expect(resolveUnauthenticatedAuthHref(false)).toBe("/onboarding");
  });

  it("resolvePostAuthRoute sends onboarded users without token to login", () => {
    expect(
      resolvePostAuthRoute({
        hasToken: false,
        onboardingComplete: true,
        entryPoint: "app_launch",
      }).pathname,
    ).toBe("/(auth)/login");
  });

  it("getPostLoginHref returns dashboard when onboarding flag is set", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("1");
    await expect(getPostLoginHref()).resolves.toBe("/(tabs)/dashboard");
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(ONBOARDING_COMPLETE_KEY);
  });

  it("getPostLoginHref returns onboarding when flag is missing or not 1", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await expect(getPostLoginHref()).resolves.toBe("/onboarding");

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("0");
    await expect(getPostLoginHref()).resolves.toBe("/onboarding");
  });

  it("getPostLoginHref returns onboarding when AsyncStorage throws", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("storage"));
    await expect(getPostLoginHref()).resolves.toBe("/onboarding");
  });

  describe("E2E mode", () => {
    beforeEach(() => {
      (isE2eModeEnabled as jest.Mock).mockReturnValue(true);
    });

    it("resolveUnauthenticatedAuthHref sends users to login", () => {
      expect(resolveUnauthenticatedAuthHref(false)).toBe("/(auth)/login");
    });

    it("resolvePostAuthRoute sends authenticated users to dashboard", () => {
      expect(
        resolvePostAuthRoute({
          hasToken: true,
          onboardingComplete: false,
          entryPoint: "login",
        }).pathname,
      ).toBe("/(tabs)/dashboard");
    });

    it("getPostLoginHref returns dashboard without reading storage", async () => {
      await expect(getPostLoginHref()).resolves.toBe("/(tabs)/dashboard");
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
  });
});
