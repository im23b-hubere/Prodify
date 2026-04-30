import { apiJson } from "./client";
import { tryParseEntitlementDto } from "./outcomesDto";
import type { EntitlementDto } from "../types/outcomes";

/** True when the user may use premium-gated APIs (paid, store trial, or server onboarding trial). */
export function hasPremiumAccess(ent: EntitlementDto | null | undefined): boolean {
  if (!ent) return false;
  return ent.entitlement === "premium" || Boolean(ent.trial_active);
}

export async function fetchEntitlement(token: string): Promise<EntitlementDto> {
  const raw = await apiJson<unknown>("/billing/entitlement", { token });
  const parsed = tryParseEntitlementDto(raw);
  return (
    parsed ?? { provider: "revenuecat", entitlement: "free", trial_active: false, expires_at: null }
  );
}

export async function syncEntitlement(
  token: string,
  body: {
    app_user_id: string;
    entitlement: "free" | "premium";
    trial_active: boolean;
    expires_at?: string | null;
  },
): Promise<EntitlementDto> {
  const raw = await apiJson<unknown>("/billing/sync", { token, method: "POST", body });
  const parsed = tryParseEntitlementDto(raw);
  if (!parsed) {
    throw new Error("Invalid entitlement sync response");
  }
  return parsed;
}
