import { apiJson } from "./client";
import { tryParseProgressionDto } from "./outcomesDto";
import type { ProgressionDto } from "../types/outcomes";

type ProgressionCacheEntry = {
  token: string;
  value: ProgressionDto | null;
  atMs: number;
};

let cached: ProgressionCacheEntry | null = null;
let inFlight: { token: string; promise: Promise<ProgressionDto | null> } | null = null;

export async function syncProgression(
  token: string,
  opts: { force?: boolean; ttlMs?: number } = {},
): Promise<ProgressionDto | null> {
  const force = Boolean(opts.force);
  const ttlMs = Math.max(0, opts.ttlMs ?? 15_000);
  const now = Date.now();

  if (!force && cached && cached.token === token && now - cached.atMs <= ttlMs) {
    return cached.value;
  }

  if (!force && inFlight && inFlight.token === token) {
    return inFlight.promise;
  }

  const request = apiJson<unknown>("/progression/sync", {
    token,
    method: "POST",
    body: {},
  })
    .then((raw) => tryParseProgressionDto(raw))
    .then((parsed) => {
      cached = { token, value: parsed, atMs: Date.now() };
      return parsed;
    })
    .finally(() => {
      if (inFlight?.promise === request) {
        inFlight = null;
      }
    });

  inFlight = { token, promise: request };
  return request;
}

export function clearProgressionSyncCache(): void {
  cached = null;
  inFlight = null;
}
