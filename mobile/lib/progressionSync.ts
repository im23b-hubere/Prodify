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

function readCached(
  token: string,
  ttlMs: number,
  force: boolean,
): ProgressionDto | null | undefined {
  if (force) return undefined;
  const now = Date.now();
  if (cached && cached.token === token && now - cached.atMs <= ttlMs) {
    return cached.value;
  }
  return undefined;
}

async function runProgressionRequest(
  token: string,
  path: "/progression/me" | "/progression/sync",
  method: "GET" | "POST",
): Promise<ProgressionDto | null> {
  const raw = await apiJson<unknown>(path, {
    token,
    method,
    body: method === "POST" ? {} : undefined,
  });
  const parsed = tryParseProgressionDto(raw);
  cached = { token, value: parsed, atMs: Date.now() };
  return parsed;
}

/** Read current progression (lightweight GET). */
export async function fetchProgression(
  token: string,
  opts: { force?: boolean; ttlMs?: number } = {},
): Promise<ProgressionDto | null> {
  const force = Boolean(opts.force);
  const ttlMs = Math.max(0, opts.ttlMs ?? 30_000);
  const hit = readCached(token, ttlMs, force);
  if (hit !== undefined) return hit;

  if (!force && inFlight && inFlight.token === token) {
    return inFlight.promise;
  }

  const request = runProgressionRequest(token, "/progression/me", "GET").finally(() => {
    if (inFlight?.promise === request) {
      inFlight = null;
    }
  });

  inFlight = { token, promise: request };
  return request;
}

/** Recompute progression (POST) — use after sessions or pull-to-refresh. */
export async function syncProgression(
  token: string,
  opts: { force?: boolean; ttlMs?: number } = {},
): Promise<ProgressionDto | null> {
  const force = Boolean(opts.force);
  const ttlMs = Math.max(0, opts.ttlMs ?? 15_000);
  const hit = readCached(token, ttlMs, force);
  if (hit !== undefined) return hit;

  if (!force && inFlight && inFlight.token === token) {
    return inFlight.promise;
  }

  const request = runProgressionRequest(token, "/progression/sync", "POST").finally(() => {
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
