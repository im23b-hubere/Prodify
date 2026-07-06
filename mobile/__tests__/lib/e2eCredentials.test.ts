import { getE2eTestCredentials } from "../../lib/e2eCredentials";

jest.mock("../../lib/e2eMode", () => ({
  isE2eModeEnabled: jest.fn(() => true),
}));

describe("e2eCredentials", () => {
  const originalEmail = process.env.EXPO_PUBLIC_E2E_TEST_EMAIL;
  const originalPassword = process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD;

  afterEach(() => {
    if (originalEmail === undefined) delete process.env.EXPO_PUBLIC_E2E_TEST_EMAIL;
    else process.env.EXPO_PUBLIC_E2E_TEST_EMAIL = originalEmail;
    if (originalPassword === undefined) delete process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD;
    else process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD = originalPassword;
  });

  it("returns baked credentials when E2E env vars are set", () => {
    process.env.EXPO_PUBLIC_E2E_TEST_EMAIL = " test@prodify.app ";
    process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD = "Test1234!";
    expect(getE2eTestCredentials()).toEqual({
      email: "test@prodify.app",
      password: "Test1234!",
    });
  });

  it("returns null when email or password is missing", () => {
    process.env.EXPO_PUBLIC_E2E_TEST_EMAIL = "test@prodify.app";
    delete process.env.EXPO_PUBLIC_E2E_TEST_PASSWORD;
    expect(getE2eTestCredentials()).toBeNull();
  });
});
