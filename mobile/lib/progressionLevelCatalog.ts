import { apiJson } from "./client";
import { PROGRESSION_NAMED_LEVEL_MAX } from "./progressionLevels";

export type ProgressionLevelItem = {
  level: number;
  xp_start: number;
  xp_end_exclusive: number;
  xp_span: number;
};

let cachedCatalog: ProgressionLevelItem[] | null = null;
let cachedDepth = 0;
let catalogInFlight: Promise<ProgressionLevelItem[]> | null = null;

export function parseLevelCatalog(raw: unknown): ProgressionLevelItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const v = item as Record<string, unknown>;
      if (
        typeof v.level !== "number" ||
        typeof v.xp_start !== "number" ||
        typeof v.xp_end_exclusive !== "number" ||
        typeof v.xp_span !== "number"
      ) {
        return null;
      }
      return {
        level: v.level,
        xp_start: v.xp_start,
        xp_end_exclusive: v.xp_end_exclusive,
        xp_span: v.xp_span,
      } satisfies ProgressionLevelItem;
    })
    .filter((x): x is ProgressionLevelItem => x !== null)
    .sort((a, b) => a.level - b.level);
}

/** Level XP table is static — cache in memory for the session. */
export async function fetchLevelCatalog(
  maxLevel: number = PROGRESSION_NAMED_LEVEL_MAX,
): Promise<ProgressionLevelItem[]> {
  const depth = Math.max(1, Math.min(200, Math.floor(maxLevel)));
  if (cachedCatalog && cachedCatalog.length > 0 && cachedDepth >= depth) {
    return cachedCatalog.slice(0, depth);
  }

  if (catalogInFlight) {
    const rows = await catalogInFlight;
    return rows.slice(0, depth);
  }

  catalogInFlight = apiJson<unknown>(`/progression/levels?max_level=${depth}`)
    .then((raw) => {
      const parsed = parseLevelCatalog(raw);
      if (parsed.length > 0) {
        cachedCatalog = parsed;
        cachedDepth = depth;
      }
      return parsed;
    })
    .finally(() => {
      catalogInFlight = null;
    });

  return catalogInFlight;
}

export function prefetchLevelCatalog(): void {
  void fetchLevelCatalog().catch(() => undefined);
}

export function clearLevelCatalogCache(): void {
  cachedCatalog = null;
  cachedDepth = 0;
  catalogInFlight = null;
}
