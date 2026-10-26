import {
  resolveResetEmail,
  resolveResetSubmission,
} from "../../../features/auth/passwordResetCredentials";

describe("resolveResetEmail", () => {
  it("trims a valid address", () => {
    expect(resolveResetEmail("  user@example.com ")).toEqual({
      ok: true,
      email: "user@example.com",
    });
  });

  it("asks for an address when the field is empty", () => {
    expect(resolveResetEmail("   ")).toEqual({ ok: false, error: "emailRequired" });
  });

  it("rejects text that is not an email address", () => {
    expect(resolveResetEmail("producer")).toEqual({ ok: false, error: "email" });
  });
});

describe("resolveResetSubmission", () => {
  it("accepts a six-digit code with surrounding spaces and a long enough password", () => {
    expect(resolveResetSubmission(" 123456 ", "new-password")).toEqual({
      ok: true,
      code: "123456",
      newPassword: "new-password",
    });
  });

  it("asks for the code when it is missing", () => {
    expect(resolveResetSubmission("", "new-password")).toEqual({
      ok: false,
      error: "codeRequired",
    });
  });

  it("rejects codes that are not six digits", () => {
    expect(resolveResetSubmission("12345", "new-password")).toEqual({
      ok: false,
      error: "codeInvalid",
    });
    expect(resolveResetSubmission("12a456", "new-password")).toEqual({
      ok: false,
      error: "codeInvalid",
    });
  });

  it("applies the registration password rules to the new password", () => {
    expect(resolveResetSubmission("123456", " ")).toEqual({ ok: false, error: "passwordRequired" });
    expect(resolveResetSubmission("123456", "short")).toEqual({
      ok: false,
      error: "passwordShort",
    });
    expect(resolveResetSubmission("123456", "x".repeat(129))).toEqual({
      ok: false,
      error: "passwordLong",
    });
  });
});
