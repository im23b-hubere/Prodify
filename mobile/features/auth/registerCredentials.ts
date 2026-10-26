type RegistrationCredentials = {
  email: string;
  username: string;
  password: string;
};

type RegistrationError =
  | "emailRequired"
  | "email"
  | "usernameRequired"
  | "usernameShort"
  | "usernameLong"
  | AccountPasswordError;

/** The server's rules for any password an account can be given (sign-up and reset). */
export type AccountPasswordError = "passwordRequired" | "passwordShort" | "passwordLong";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function accountPasswordError(password: string): AccountPasswordError | null {
  if (!password.trim()) return "passwordRequired";
  if (password.length < 8) return "passwordShort";
  if (password.length > 128) return "passwordLong";
  return null;
}

export function resolveRegistrationCredentials(
  email: string,
  username: string,
  password: string,
): { ok: true; credentials: RegistrationCredentials } | { ok: false; error: RegistrationError } {
  const credentials = { email: email.trim(), username: username.trim(), password };
  if (!credentials.email) return { ok: false, error: "emailRequired" };
  if (!isEmailAddress(credentials.email)) return { ok: false, error: "email" };
  if (!credentials.username) return { ok: false, error: "usernameRequired" };
  if (credentials.username.length < 2) return { ok: false, error: "usernameShort" };
  if (credentials.username.length > 64) return { ok: false, error: "usernameLong" };
  const passwordError = accountPasswordError(credentials.password);
  if (passwordError) return { ok: false, error: passwordError };
  return { ok: true, credentials };
}
