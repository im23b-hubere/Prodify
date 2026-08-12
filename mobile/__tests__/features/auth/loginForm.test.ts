import { resolveLoginCredentials } from "../../../features/auth/loginCredentials";

describe("login credentials", () => {
  it("normalizes a manually entered email", () => {
    expect(resolveLoginCredentials("  user@example.com  ", "secret", null)).toEqual({
      ok: true,
      email: "user@example.com",
      password: "secret",
    });
  });

  it("uses the E2E preset only when the email field is empty", () => {
    const preset = { email: "e2e@example.com", password: "e2e-secret" };

    expect(resolveLoginCredentials("", "", preset)).toEqual({
      ok: true,
      email: "e2e@example.com",
      password: "e2e-secret",
    });
    expect(resolveLoginCredentials("manual@example.com", "", preset)).toEqual({
      ok: false,
      missing: "password",
    });
  });

  it("reports the first missing field", () => {
    expect(resolveLoginCredentials("", "", null)).toEqual({ ok: false, missing: "email" });
    expect(resolveLoginCredentials("user@example.com", "", null)).toEqual({
      ok: false,
      missing: "password",
    });
  });
});
