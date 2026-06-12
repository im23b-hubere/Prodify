import { isE2eModeEnabled } from "../../lib/e2eMode";

describe("isE2eModeEnabled", () => {
  const original = process.env.EXPO_PUBLIC_E2E_MODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_E2E_MODE;
    } else {
      process.env.EXPO_PUBLIC_E2E_MODE = original;
    }
  });

  it("returns false when unset", () => {
    delete process.env.EXPO_PUBLIC_E2E_MODE;
    expect(isE2eModeEnabled()).toBe(false);
  });

  it("returns true when EXPO_PUBLIC_E2E_MODE is true", () => {
    process.env.EXPO_PUBLIC_E2E_MODE = "true";
    expect(isE2eModeEnabled()).toBe(true);
  });
});
