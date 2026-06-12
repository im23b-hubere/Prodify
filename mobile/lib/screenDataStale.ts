/** Shared TTL for tab screen refetches on focus (pull-to-refresh always forces). */
export const SCREEN_DATA_STALE_MS = 45_000;

export function isScreenDataStale(
  lastFetchMs: number,
  staleMs: number = SCREEN_DATA_STALE_MS,
): boolean {
  if (lastFetchMs <= 0) return true;
  return Date.now() - lastFetchMs >= staleMs;
}
