import Constants from "expo-constants";

import { getE2eTestCredentials } from "../../lib/e2eCredentials";
import { isE2eModeEnabled } from "../../lib/e2eMode";

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: jest.fn(() => true),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

describe("e2eCredentials", () => {
  const originalEmail = process.env.EXPO_PUBLIC_E2E_TEST_EMAIL;
  const originalPassword = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD;

  beforeEach(() => {
    (Constants.expoConfig as { extra: Record<string, unknown> }).extra = { e2eMode: true };
    delete process.env.EXPO_PUBLIC_E2E_TEST_EMAIL;
    delete process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD;
  });

  afterEach(() => {
    if (originalEmail === undefined) delete process.env.EXPO_PUBLIC_E2E_TEST_EMAIL;
    else process.env.EXPO_PUBLIC_E2E_TEST_EMAIL = originalEmail;
    if (originalPassword === undefined) delete process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD;
    else process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD = originalPassword;
  });

  it("prefers credentials baked into expo extra", () => {
    (Constants.expoConfig as { extra: Record<string, unknown> }).extra = {
      e2eMode: true,
      e2eTestEmail: "extra@prodify.app",
      e2eTestPassword: "from-extra",
    };
    expect(getE2eTestCredentials()).toEqual({
      email: "extra@prodify.app",
      password: "from-extra",
    });
  });

  it("falls back to E2E defaults when nothing is baked in", () => {
    (Constants.expoConfig as { extra: Record<string, unknown> }).extra = { e2eMode: true };
    expect(getE2eTestCredentials()).toEqual({
      email: "test@prodify.app",
      password: "Test1234!",
    });
  });

  it("returns null outside E2E mode", () => {
    (isE2eModeEnabled as jest.Mock).mockReturnValue(false);
    expect(getE2eTestCredentials()).toBeNull();
  });
});
