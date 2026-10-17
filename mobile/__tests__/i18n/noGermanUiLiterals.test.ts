import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components", "features"].map((dir) =>
  join(__dirname, "..", "..", dir),
);
const GERMAN_CHAR = /[äöüÄÖÜß]/;
const SKIP_DIR = new Set(["__tests__", "node_modules", ".expo"]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) files.push(path);
  }
  return files;
}

describe("no German UI literals in production screens", () => {
  it("keeps app/components/features free of German characters", () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const source = readFileSync(file, "utf8");
        if (!GERMAN_CHAR.test(source)) continue;
        const rel = relative(join(__dirname, "../.."), file).replace(/\\/g, "/");
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
