import de from "../../locales/de.json";
import en from "../../locales/en.json";

function walk(
  enNode: unknown,
  deNode: unknown,
  path = "",
  mismatches: { path: string; en: string; de: string }[] = [],
): { path: string; en: string; de: string }[] {
  if (typeof enNode === "string") {
    const enPh = [...enNode.matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();
    const dePh = [...String(deNode ?? "").matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]).sort();
    if (enPh.join("\0") !== dePh.join("\0")) {
      mismatches.push({ path, en: enNode, de: String(deNode ?? "") });
    }
    return mismatches;
  }
  if (Array.isArray(enNode)) {
    enNode.forEach((value, index) =>
      walk(value, Array.isArray(deNode) ? deNode[index] : undefined, `${path}[${index}]`, mismatches),
    );
    return mismatches;
  }
  if (enNode && typeof enNode === "object") {
    for (const key of Object.keys(enNode as object)) {
      walk(
        (enNode as Record<string, unknown>)[key],
        (deNode as Record<string, unknown> | undefined)?.[key],
        path ? `${path}.${key}` : key,
        mismatches,
      );
    }
  }
  return mismatches;
}

describe("German locale placeholder parity", () => {
  it("keeps the same {{interpolation}} tokens as English", () => {
    const mismatches = walk(en, de);
    expect(mismatches).toEqual([]);
  });
});
