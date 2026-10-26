import { currentAppLocaleTag } from "../../lib/appLocale";
import { apiJson } from "../../lib/client";

// Render can need close to a minute to wake after an idle period.
const REQUEST_TIMEOUT_MS = 90_000;

/** The server answers the same for every address, so success does not mean an account exists. */
export async function requestPasswordResetCode(email: string): Promise<void> {
  await apiJson("/auth/password-reset/request", {
    method: "POST",
    body: { email, locale: currentAppLocaleTag() },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}
