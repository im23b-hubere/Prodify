import {
  accountPasswordError,
  isEmailAddress,
  type AccountPasswordError,
} from "./registerCredentials";

type ResetEmailError = "emailRequired" | "email";
type ResetSubmissionError = "codeRequired" | "codeInvalid" | AccountPasswordError;

const RESET_CODE_PATTERN = /^\d{6}$/;

export function resolveResetEmail(
  email: string,
): { ok: true; email: string } | { ok: false; error: ResetEmailError } {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "emailRequired" };
  if (!isEmailAddress(trimmed)) return { ok: false, error: "email" };
  return { ok: true, email: trimmed };
}

export function resolveResetSubmission(
  code: string,
  newPassword: string,
): { ok: true; code: string; newPassword: string } | { ok: false; error: ResetSubmissionError } {
  const trimmedCode = code.trim();
  if (!trimmedCode) return { ok: false, error: "codeRequired" };
  if (!RESET_CODE_PATTERN.test(trimmedCode)) return { ok: false, error: "codeInvalid" };
  const passwordError = accountPasswordError(newPassword);
  if (passwordError) return { ok: false, error: passwordError };
  return { ok: true, code: trimmedCode, newPassword };
}
