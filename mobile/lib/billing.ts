import { apiJson } from "./client";
import { isDevBillingBypassActive } from "./devBillingBypass";
import { clearPersistedEntitlement, loadPersistedEntitlement, persistEntitlement } from "./entitlementStorage";
import { tryParseEntitlementDto } from "./outcomesDto";
import type { EntitlementDto } from "../types/outcomes";

type EntitlementCacheEntry = {
  token: string;
  userId: number | null;
  value: EntitlementDto;
  atMs: number;
};

let cachedEntitlement: EntitlementCacheEntry | null = null;
let entitlementInFlight: { token: string; promise: Promise<EntitlementDto> } | null = null;

const ENTITLEMENT_TTL_MS = 5 * 60_000;
const PREMIUM_ENTITLEMENT_TTL_MS = 24 * 60 * 60_000;

/** True when the user may use subscription-gated APIs. */
export function hasPremiumAccess(ent: EntitlementDto | null | undefined): boolean {
  if (!ent) return false;
  return ent.entitlement === "premium";
}

function cacheTtlFor(ent: EntitlementDto): number {
  return ent.entitlement === "premium" ? PREMIUM_ENTITLEMENT_TTL_MS : ENTITLEMENT_TTL_MS;
}

function writeEntitlementCache(token: string, value: EntitlementDto, userId?: number | null): void {
  cachedEntitlement = {
    token,
    userId: userId ?? null,
    value,
    atMs: Date.now(),
  };
  if (userId != null) {
    void persistEntitlement(userId, value).catch(() => undefined);
  }
}

export function clearEntitlementCache(): void {
  cachedEntitlement = null;
  entitlementInFlight = null;
}

export async function clearEntitlementCacheForUser(userId: number): Promise<void> {
  if (cachedEntitlement?.userId === userId) {
    cachedEntitlement = null;
  }
  await clearPersistedEntitlement(userId);
}

/** Cached entitlement for this token, or null if missing / stale / wrong user. */
export function getCachedEntitlement(token: string): EntitlementDto | null {
  if (!cachedEntitlement || cachedEntitlement.token !== token) {
    return null;
  }
  if (Date.now() - cachedEntitlement.atMs > cacheTtlFor(cachedEntitlement.value)) {
    return null;
  }
  return cachedEntitlement.value;
}

/** Synchronous subscription access check from cache; null when cache is unavailable. */
export function peekCachedHasPremiumAccess(token: string): boolean | null {
  const ent = getCachedEntitlement(token);
  if (!ent) return null;
  return hasPremiumAccess(ent);
}

/** Load premium from device storage (cold start fast path). */
export async function peekStoredHasPremiumAccess(userId: number): Promise<boolean> {
  const ent = await loadPersistedEntitlement(userId);
  return hasPremiumAccess(ent);
}

/** Optimistically warm entitlement cache (e.g. after purchase or restore). */
export function seedEntitlementCache(
  token: string,
  value: EntitlementDto,
  userId?: number | null,
): void {
  writeEntitlementCache(token, value, userId);
}

export async function fetchEntitlement(
  token: string,
  opts: { force?: boolean; userId?: number | null } = {},
): Promise<EntitlementDto> {
  const force = Boolean(opts.force);
  const userId = opts.userId ?? cachedEntitlement?.userId ?? null;
  const now = Date.now();

  if (
    !force &&
    cachedEntitlement &&
    cachedEntitlement.token === token &&
    now - cachedEntitlement.atMs <= cacheTtlFor(cachedEntitlement.value)
  ) {
    return cachedEntitlement.value;
  }

  if (!force && __DEV__) {
    const bypass = await isDevBillingBypassActive().catch(() => false);
    if (
      bypass &&
      cachedEntitlement &&
      cachedEntitlement.token === token &&
      hasPremiumAccess(cachedEntitlement.value)
    ) {
      return cachedEntitlement.value;
    }
  }

  if (!force && entitlementInFlight && entitlementInFlight.token === token) {
    return entitlementInFlight.promise;
  }

  const request = apiJson<unknown>("/billing/entitlement", { token, timeoutMs: 12_000 })
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
      writeEntitlementCache(token, value, userId);
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
  const raw = await apiJson<unknown>("/billing/sync", { token, method: "POST", body, timeoutMs: 15_000 });
  const parsed = tryParseEntitlementDto(raw);
  if (!parsed) {
    throw new Error("Invalid entitlement sync response");
  }
  const userId = Number.parseInt(body.app_user_id, 10);
  writeEntitlementCache(token, parsed, Number.isFinite(userId) ? userId : null);
  return parsed;
}
