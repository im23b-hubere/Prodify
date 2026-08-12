import { resolveRegistrationCredentials } from "../../../features/auth/registerCredentials";

describe("registration credentials", () => {
  it("normalizes email and username", () => {
    expect(
      resolveRegistrationCredentials("  user@example.com ", "  producer ", "password"),
    ).toEqual({
      ok: true,
      credentials: { email: "user@example.com", username: "producer", password: "password" },
    });
  });

  it.each([
    ["", "producer", "password", "emailRequired"],
    ["user@example.com", "", "password", "usernameRequired"],
    ["user@example.com", "x", "password", "usernameShort"],
    ["user@example.com", "producer", "", "passwordRequired"],
    ["user@example.com", "producer", "short", "passwordShort"],
  ])("reports the first invalid field", (email, username, password, error) => {
    expect(resolveRegistrationCredentials(email, username, password)).toEqual({ ok: false, error });
  });
});
