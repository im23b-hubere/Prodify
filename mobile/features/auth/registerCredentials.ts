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
  | "passwordRequired"
  | "passwordShort"
  | "passwordLong";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveRegistrationCredentials(
  email: string,
  username: string,
  password: string,
): { ok: true; credentials: RegistrationCredentials } | { ok: false; error: RegistrationError } {
  const credentials = { email: email.trim(), username: username.trim(), password };
  if (!credentials.email) return { ok: false, error: "emailRequired" };
  if (!EMAIL_PATTERN.test(credentials.email)) return { ok: false, error: "email" };
  if (!credentials.username) return { ok: false, error: "usernameRequired" };
  if (credentials.username.length < 2) return { ok: false, error: "usernameShort" };
  if (credentials.username.length > 64) return { ok: false, error: "usernameLong" };
  if (!credentials.password.trim()) return { ok: false, error: "passwordRequired" };
  if (credentials.password.length < 8) return { ok: false, error: "passwordShort" };
  if (credentials.password.length > 128) return { ok: false, error: "passwordLong" };
  return { ok: true, credentials };
}
