import Constants from "expo-constants";

import { isE2eModeEnabled } from "../../lib/e2eMode";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

describe("isE2eModeEnabled", () => {
  const original = process.env.EXPO_PUBLIC_E2E_MODE;
  const originalAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
  const originalEnv = process.env.EXPO_PUBLIC_ENV;

  beforeEach(() => {
    (Constants.expoConfig as { extra: Record<string, unknown> }).extra = {};
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    } else {
      process.env.EXPO_PUBLIC_E2E_MODE = original;
    }
    if (originalAppEnv === undefined) {
      delete process.env.EXPO_PUBLIC_APP_ENV;
    } else {
      process.env.EXPO_PUBLIC_APP_ENV = originalAppEnv;
    }
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_ENV;
    } else {
      process.env.EXPO_PUBLIC_ENV = originalEnv;
    }
  });

  it("returns false when unset", () => {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
    expect(isE2eModeEnabled()).toBe(false);
  });

  it("returns true when baked into expo extra", () => {
    (Constants.expoConfig as { extra: Record<string, unknown> }).extra = { e2eMode: true };
    delete process.env.EXPO_PUBLIC_E2E_MODE;
    expect(isE2eModeEnabled()).toBe(true);
  });

  it("returns true when EXPO_PUBLIC_E2E_MODE is true", () => {
    process.env.EXPO_PUBLIC_E2E_MODE = "true";
    process.env.EXPO_PUBLIC_APP_ENV = "staging";
    expect(isE2eModeEnabled()).toBe(true);
  });

  it("returns false when production env accidentally sets E2E mode", () => {
    process.env.EXPO_PUBLIC_E2E_MODE = "true";
    process.env.EXPO_PUBLIC_APP_ENV = "production";
    expect(isE2eModeEnabled()).toBe(false);
  });
});
