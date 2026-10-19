import { APP_LANGUAGE_DEFINITIONS, APP_LANGUAGES, FALLBACK_APP_LANGUAGE } from "../../lib/i18nLanguages";

function walk(
  enNode: unknown,
  localeNode: unknown,
  path = "",
  mismatches: { path: string; en: string; locale: string }[] = [],
): { path: string; en: string; locale: string }[] {
  if (typeof enNode === "string") {
    const enPh = [...enNode.matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();
    const localePh = [...String(localeNode ?? "").matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();
    if (enPh.join("\0") !== localePh.join("\0")) {
      mismatches.push({ path, en: enNode, locale: String(localeNode ?? "") });
    }
    return mismatches;
  }
  if (Array.isArray(enNode)) {
    enNode.forEach((value, index) =>
      walk(
        value,
        Array.isArray(localeNode) ? localeNode[index] : undefined,
        `${path}[${index}]`,
        mismatches,
      ),
    );
    return mismatches;
  }
  if (enNode && typeof enNode === "object") {
    for (const key of Object.keys(enNode as object)) {
      walk(
        (enNode as Record<string, unknown>)[key],
        (localeNode as Record<string, unknown> | undefined)?.[key],
        path ? `${path}.${key}` : key,
        mismatches,
      );
    }
  }
  return mismatches;
}

describe("locale placeholder parity", () => {
  it("keeps the same {{interpolation}} tokens as English in every registered catalog", () => {
    const english = APP_LANGUAGE_DEFINITIONS[FALLBACK_APP_LANGUAGE].translation;
    for (const code of APP_LANGUAGES) {
      if (code === FALLBACK_APP_LANGUAGE) continue;
      const mismatches = walk(english, APP_LANGUAGE_DEFINITIONS[code].translation);
      expect({ locale: code, mismatches }).toEqual({ locale: code, mismatches: [] });
    }
  });
});
