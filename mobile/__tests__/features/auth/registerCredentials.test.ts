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
    ["not-an-email", "producer", "password", "email"],
    ["user@example.com", "", "password", "usernameRequired"],
    ["user@example.com", "x", "password", "usernameShort"],
    ["user@example.com", "a".repeat(65), "password", "usernameLong"],
    ["user@example.com", "producer", "", "passwordRequired"],
    ["user@example.com", "producer", "short", "passwordShort"],
    ["user@example.com", "producer", "p".repeat(129), "passwordLong"],
  ])("reports the first invalid field", (email, username, password, error) => {
    expect(resolveRegistrationCredentials(email, username, password)).toEqual({ ok: false, error });
  });
});
