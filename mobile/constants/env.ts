import Constants from "expo-constants";

function readPublicEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readExtraString(key: string): string | null {
  const candidates: Record<string, unknown>[] = [];
  const expoExtra = Constants.expoConfig?.extra;
  if (expoExtra && typeof expoExtra === "object")
    candidates.push(expoExtra as Record<string, unknown>);

  const manifestExtra = (
    Constants.manifest as { extra?: Record<string, unknown> } | null | undefined
  )?.extra;
  if (manifestExtra && typeof manifestExtra === "object") {
    candidates.push(manifestExtra);
  }

  const manifest2Extra = (Constants as { manifest2?: { extra?: Record<string, unknown> } })
    .manifest2?.extra;
  if (manifest2Extra && typeof manifest2Extra === "object") candidates.push(manifest2Extra);

  for (const extra of candidates) {
    const value = extra[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function readEmbeddedApiUrlFromManifest(): string | null {
  const extra = Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined;
  const fromExtra = typeof extra?.apiUrl === "string" ? extra.apiUrl.trim() : "";
  if (fromExtra) return fromExtra;

  const manifestExtra = (Constants.manifest as { extra?: { apiUrl?: unknown } } | null | undefined)
    ?.extra;
  const fromManifest = typeof manifestExtra?.apiUrl === "string" ? manifestExtra.apiUrl.trim() : "";
  return fromManifest || null;
}

export function getExpoPublicApiUrl(): string | null {
  return readPublicEnv("EXPO_PUBLIC_API_URL") ?? readEmbeddedApiUrlFromManifest();
}

export function getExpoPublicAppEnv(): string | null {
  return readPublicEnv("EXPO_PUBLIC_APP_ENV") ?? readPublicEnv("EXPO_PUBLIC_ENV");
}

export function getExpoPublicSentryDsn(): string | null {
  return readPublicEnv("EXPO_PUBLIC_SENTRY_DSN");
}

export function getExpoPublicRevenueCatApiKey(): string | null {
  return readPublicEnv("EXPO_PUBLIC_REVENUECAT_API_KEY") ?? readExtraString("revenueCatApiKey");
}

export function getExpoPublicRevenueCatEntitlementId(): string | null {
  return (
    readPublicEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID") ??
    readExtraString("revenueCatEntitlementId")
  );
}
