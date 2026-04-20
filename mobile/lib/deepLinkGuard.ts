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
  /^dashboard$/,
  /^stats$/,
  /^friends$/,
  /^profile$/,
  /^notifications$/,
  /^paywall$/,
  /^weekly-recap$/,
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
