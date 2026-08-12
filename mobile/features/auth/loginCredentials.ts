type LoginCredentials = { ok: true; email: string; password: string };
type InvalidLoginCredentials = { ok: false; missing: "email" | "password" };

export function resolveLoginCredentials(
  email: string,
  password: string,
  preset: { email: string; password: string } | null,
): LoginCredentials | InvalidLoginCredentials {
  const manualEmail = email.trim();
  const normalizedEmail = manualEmail || preset?.email || "";
  const resolvedPassword = !manualEmail && preset ? preset.password : password;
  if (!normalizedEmail) return { ok: false, missing: "email" };
  if (!resolvedPassword.trim()) return { ok: false, missing: "password" };
  return { ok: true, email: normalizedEmail, password: resolvedPassword };
}
