import {
  DASHBOARD_TAB_HREF,
  POST_REGISTER_HREF,
  resolvePostAuthRoute,
  resolveUnauthenticatedAuthHref,
} from "../lib/postAuthNavigation";
import { isE2eModeEnabled } from "../lib/e2eMode";

jest.mock("../lib/e2eMode", () => ({
  isE2eModeEnabled: jest.fn(() => false),
}));

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

  it("resolvePostAuthRoute keeps authenticated onboarded users on dashboard at cold start", () => {
    expect(
      resolvePostAuthRoute({
        hasToken: true,
        onboardingComplete: true,
        entryPoint: "app_launch",
        allowPaywallPrompt: false,
      }).pathname,
    ).toBe("/(tabs)/dashboard");
  });

  it("resolvePostAuthRoute sends authenticated users back to onboarding when the flag is missing", () => {
    expect(
      resolvePostAuthRoute({
        hasToken: true,
        onboardingComplete: false,
        entryPoint: "app_launch",
        allowPaywallPrompt: false,
      }).pathname,
    ).toBe("/onboarding");
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
  });
});
