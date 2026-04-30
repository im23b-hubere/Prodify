const PUBLIC_PATH_PATTERNS: RegExp[] = [
  /^$/,
  /^\/$/,
  /^login$/,
  /^register$/,
  /^onboarding$/,
  /^legal\/privacy$/,
  /^legal\/terms$/,
];

const ALLOWED_PATH_PATTERNS: RegExp[] = [
  ...PUBLIC_PATH_PATTERNS,
  /^\(tabs\)\/dashboard$/,
  /^\(tabs\)\/stats$/,
  /^\(tabs\)\/friends$/,
  /^\(tabs\)\/profile$/,
  /^dashboard$/,
  /^stats$/,
  /^friends$/,
  /^session-trash$/,
  /^profile$/,
  /^notifications$/,
  /^paywall$/,
  /^weekly-recap$/,
  /^progression-overview$/,
  /^session\/setup$/,
  /^session\/active$/,
  /^session\/complete$/,
  /^session\/\d+$/,
  /^profile\/\d+$/,
  /^streak\/history$/,
];

export function normalizeIncomingPath(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/^\/+/, "").replace(/\/+$/, "").trim();
}

/**
 * Derives the in-app route key from a full incoming URL.
 * - `prodify://dashboard` (host-only) and `prodify://session/42` (host + path) both resolve correctly
 *   (Expo `Linking.parse` only exposes `pathname` and loses the host for the first form).
 * - `prodify:///dashboard` (path-only) is supported.
 * - HTTPS / universal links: pathname segments only (web host ignored).
 */
export function extractDeepLinkPath(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const u = new URL(trimmed);
    const scheme = u.protocol.replace(/:$/, "").toLowerCase();
    const host = (u.hostname || "").trim();
    const pathPart = (u.pathname || "").replace(/^\/+|\/+$/g, "");

    if (scheme === "prodify") {
      if (host && pathPart) return normalizeIncomingPath(`${host}/${pathPart}`);
      if (host) return normalizeIncomingPath(host);
      if (pathPart) return normalizeIncomingPath(pathPart);
      return "";
    }

    if (pathPart) return normalizeIncomingPath(pathPart);
    return "";
  } catch {
    return normalizeIncomingPath(trimmed);
  }
}

export function isAllowedDeepLinkPath(path: string | null | undefined): boolean {
  const normalized = normalizeIncomingPath(path);
  return ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function deepLinkRequiresAuth(path: string | null | undefined): boolean {
  const normalized = normalizeIncomingPath(path);
  return !PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function toRoutableHref(path: string | null | undefined): `/${string}` {
  const normalized = normalizeIncomingPath(path);
  if (!normalized) return "/";
  return `/${normalized}`;
}
