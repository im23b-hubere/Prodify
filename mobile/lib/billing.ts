import { apiJson } from "./client";
import { tryParseEntitlementDto } from "./outcomesDto";
import type { EntitlementDto } from "../types/outcomes";

type EntitlementCacheEntry = {
  token: string;
  value: EntitlementDto;
  atMs: number;
};

let cachedEntitlement: EntitlementCacheEntry | null = null;
let entitlementInFlight: { token: string; promise: Promise<EntitlementDto> } | null = null;

const ENTITLEMENT_TTL_MS = 60_000;

/** True when the user may use premium-gated APIs (paid, store trial, or server onboarding trial). */
export function hasPremiumAccess(ent: EntitlementDto | null | undefined): boolean {
  if (!ent) return false;
  return ent.entitlement === "premium" || Boolean(ent.trial_active);
}

export function clearEntitlementCache(): void {
  cachedEntitlement = null;
  entitlementInFlight = null;
}

/** Cached entitlement for this token, or null if missing / stale / wrong user. */
export function getCachedEntitlement(token: string): EntitlementDto | null {
  if (!cachedEntitlement || cachedEntitlement.token !== token) {
    return null;
  }
  if (Date.now() - cachedEntitlement.atMs > ENTITLEMENT_TTL_MS) {
    return null;
  }
  return cachedEntitlement.value;
}

/** Synchronous premium check from cache; null when cache is unavailable. */
export function peekCachedHasPremiumAccess(token: string): boolean | null {
  const ent = getCachedEntitlement(token);
  if (!ent) return null;
  return hasPremiumAccess(ent);
}

/** Optimistically warm entitlement cache (e.g. dev paywall skip). */
export function seedEntitlementCache(token: string, value: EntitlementDto): void {
  cachedEntitlement = { token, value, atMs: Date.now() };
}

export async function fetchEntitlement(
  token: string,
  opts: { force?: boolean } = {},
): Promise<EntitlementDto> {
  const force = Boolean(opts.force);
  const now = Date.now();

  if (
    !force &&
    cachedEntitlement &&
    cachedEntitlement.token === token &&
    now - cachedEntitlement.atMs <= ENTITLEMENT_TTL_MS
  ) {
    return cachedEntitlement.value;
  }

  if (!force && entitlementInFlight && entitlementInFlight.token === token) {
    return entitlementInFlight.promise;
  }

  const request = apiJson<unknown>("/billing/entitlement", { token })
    .then((raw) => {
      const parsed = tryParseEntitlementDto(raw);
      const value: EntitlementDto =
        parsed ??
        ({
          provider: "revenuecat",
          entitlement: "free",
          trial_active: false,
          expires_at: null,
        } as const);
      cachedEntitlement = { token, value, atMs: Date.now() };
      return value;
    })
    .finally(() => {
      if (entitlementInFlight?.promise === request) {
        entitlementInFlight = null;
      }
    });

  entitlementInFlight = { token, promise: request };
  return request;
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
  cachedEntitlement = { token, value: parsed, atMs: Date.now() };
  return parsed;
}
