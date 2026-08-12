export type TokenPair = { access_token: string; refresh_token: string };

type ReadRefreshToken = () => Promise<string | null>;
type ApplyTokenPair = (pair: TokenPair) => Promise<void>;
type RequestTokenPair = (refreshToken: string) => Promise<TokenPair>;

const REFRESH_ACCESS_TIMEOUT_MS = 12_000;

let readRefreshToken: ReadRefreshToken | null = null;
let applyTokenPair: ApplyTokenPair | null = null;
let inFlightRefresh: Promise<TokenPair | null> | null = null;

export function setAuthRefreshBridge(
  readToken: ReadRefreshToken | null,
  applyPair: ApplyTokenPair | null,
): void {
  readRefreshToken = readToken;
  applyTokenPair = applyPair;
}

export async function refreshAccessToken(
  requestTokenPair: RequestTokenPair,
): Promise<TokenPair | null> {
  if (inFlightRefresh) return settleRefresh(inFlightRefresh);

  const refresh = performRefresh(requestTokenPair);
  inFlightRefresh = refresh;
  try {
    return await settleRefresh(refresh);
  } finally {
    if (inFlightRefresh === refresh) inFlightRefresh = null;
  }
}

async function performRefresh(requestTokenPair: RequestTokenPair): Promise<TokenPair | null> {
  if (!readRefreshToken || !applyTokenPair) return null;
  const storedToken = (await readRefreshToken())?.trim();
  if (!storedToken) return null;

  const pair = await withTimeout(requestTokenPair(storedToken), REFRESH_ACCESS_TIMEOUT_MS);
  if (!pair) return null;
  const normalized = normalizeTokenPair(pair);
  if (!normalized) return null;
  await applyTokenPair(normalized);
  return normalized;
}

async function settleRefresh(refresh: Promise<TokenPair | null>): Promise<TokenPair | null> {
  try {
    return await refresh;
  } catch {
    return null;
  }
}

function normalizeTokenPair(pair: TokenPair): TokenPair | null {
  if (typeof pair.access_token !== "string" || typeof pair.refresh_token !== "string") return null;
  const accessToken = pair.access_token.trim();
  const refreshToken = pair.refresh_token.trim();
  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
