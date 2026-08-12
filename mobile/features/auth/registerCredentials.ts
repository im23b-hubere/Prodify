type RegistrationCredentials = {
  email: string;
  username: string;
  password: string;
};

type RegistrationError =
  | "emailRequired"
  | "usernameRequired"
  | "usernameShort"
  | "passwordRequired"
  | "passwordShort";

export function resolveRegistrationCredentials(
  email: string,
  username: string,
  password: string,
): { ok: true; credentials: RegistrationCredentials } | { ok: false; error: RegistrationError } {
  const credentials = { email: email.trim(), username: username.trim(), password };
  if (!credentials.email) return { ok: false, error: "emailRequired" };
  if (!credentials.username) return { ok: false, error: "usernameRequired" };
  if (credentials.username.length < 2) return { ok: false, error: "usernameShort" };
  if (!credentials.password.trim()) return { ok: false, error: "passwordRequired" };
  if (credentials.password.length < 8) return { ok: false, error: "passwordShort" };
  return { ok: true, credentials };
}
