/**
 * Machine-translate en.json into every App Store UI language in app-languages.mjs.
 * Preserves {{placeholders}}; falls back to English when tokens would be lost.
 *
 * Usage: node scripts/i18n/generate-app-locales.mjs [--only=tr,es] [--force]
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import translate from "google-translate-api-x";

import { APP_UI_LANGUAGES, DEVICE_LANGUAGE_ALIASES } from "./app-languages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const localesDir = path.join(root, "mobile/locales");
const i18nLanguagesPath = path.join(root, "mobile/lib/i18nLanguages.ts");

async function localeFileExists(code) {
  try {
    const info = await stat(path.join(localesDir, `${code}.json`));
    return info.size > 0;
  } catch {
    return false;
  }
}

const BATCH_SIZE = 12;
const BATCH_DELAY_MS = 400;
const LANGUAGE_CONCURRENCY = 1;
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.find((arg) => arg.startsWith("--only="));
const only = onlyArg
  ? new Set(
      onlyArg
        .slice("--only=".length)
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    )
  : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function placeholders(text) {
  return [...String(text).matchAll(PLACEHOLDER_RE)].map((match) => match[0]).sort();
}

function protect(text) {
  const tokens = [];
  const protectedText = String(text).replace(PLACEHOLDER_RE, (match) => {
    const index = tokens.length;
    tokens.push(match);
    return `⟦${index}⟧`;
  });
  return { protectedText, tokens };
}

function restore(text, tokens) {
  return String(text).replace(/⟦(\d+)⟧/g, (_, index) => tokens[Number(index)] ?? "");
}

function collectLeaves(node, pathParts = [], out = []) {
  if (typeof node === "string") {
    out.push({ path: pathParts, value: node });
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => collectLeaves(value, [...pathParts, index], out));
    return out;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      collectLeaves(value, [...pathParts, key], out);
    }
  }
  return out;
}

function setAtPath(rootNode, pathParts, value) {
  let cursor = rootNode;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    cursor = cursor[pathParts[i]];
  }
  cursor[pathParts[pathParts.length - 1]] = value;
}

async function translateOne(text, to) {
  const result = await translate(text, { from: "en", to, forceBatch: false });
  return result.text;
}

async function translateBatch(texts, to) {
  try {
    const result = await translate(texts, {
      from: "en",
      to,
      forceBatch: true,
      rejectOnPartialFail: false,
    });
    const items = Array.isArray(result) ? result : [result];
    const out = [];
    for (let i = 0; i < texts.length; i += 1) {
      const text = items[i]?.text;
      if (text) {
        out.push(text);
        continue;
      }
      try {
        out.push(await translateOne(texts[i], to));
      } catch {
        out.push(texts[i]);
      }
      await sleep(120);
    }
    return out;
  } catch {
    const out = [];
    for (const text of texts) {
      try {
        out.push(await translateOne(text, to));
      } catch {
        out.push(text);
      }
      await sleep(120);
    }
    return out;
  }
}

function settleTranslation(source, restored) {
  return placeholders(source).join("\0") === placeholders(restored).join("\0") ? restored : source;
}

async function translateLeaves(leaves, googleTo, label) {
  const translated = new Array(leaves.length);
  for (let start = 0; start < leaves.length; start += BATCH_SIZE) {
    const slice = leaves.slice(start, start + BATCH_SIZE);
    const protectedSlice = slice.map((leaf) => protect(leaf.value));
    let attempts = 0;
    for (;;) {
      try {
        const batch = await translateBatch(
          protectedSlice.map((item) => item.protectedText),
          googleTo,
        );
        batch.forEach((text, offset) => {
          const index = start + offset;
          const { tokens } = protectedSlice[offset];
          translated[index] = settleTranslation(leaves[index].value, restore(text, tokens));
        });
        break;
      } catch (error) {
        attempts += 1;
        if (attempts >= 6) {
          console.warn(`  ${label}: giving up batch at ${start}, keeping English`);
          slice.forEach((leaf, offset) => {
            translated[start + offset] = leaf.value;
          });
          break;
        }
        console.warn(`  ${label} retry ${attempts}: ${String(error.message ?? error).slice(0, 120)}`);
        await sleep(2000 * attempts);
      }
    }
    if (start % (BATCH_SIZE * 8) === 0 || start + BATCH_SIZE >= leaves.length) {
      console.log(`  ${label}: ${Math.min(start + BATCH_SIZE, leaves.length)}/${leaves.length}`);
    }
    await sleep(BATCH_DELAY_MS);
  }
  return translated;
}

function importName(code) {
  return `locale_${code.replace(/-/g, "_")}`;
}

function buildI18nLanguagesSource(languages) {
  const imports = languages
    .map((lang) => `import ${importName(lang.code)} from "../locales/${lang.code}.json";`)
    .join("\n");

  const definitions = languages
    .map(
      (lang) => `  "${lang.code}": {
    localeTag: "${lang.localeTag}",
    nativeName: ${JSON.stringify(lang.nativeName)},
    translation: ${importName(lang.code)},
  },`,
    )
    .join("\n");

  const aliases = Object.entries(DEVICE_LANGUAGE_ALIASES)
    .map(([from, to]) => `  "${from}": "${to}",`)
    .join("\n");

  return `/**
 * App language catalog — generated by scripts/i18n/generate-app-locales.mjs
 * Source list: scripts/i18n/app-languages.mjs
 *
 * To add a language: update app-languages.mjs, then run:
 *   node scripts/i18n/generate-app-locales.mjs --only=<code>
 */
${imports}

export const FALLBACK_APP_LANGUAGE = "en" as const;

export type AppLanguageDefinition = {
  localeTag: string;
  nativeName: string;
  translation: typeof locale_en;
};

export const APP_LANGUAGE_DEFINITIONS = {
${definitions}
} as const satisfies Record<string, AppLanguageDefinition>;

export type AppLanguage = keyof typeof APP_LANGUAGE_DEFINITIONS;

export const APP_LANGUAGES = Object.keys(APP_LANGUAGE_DEFINITIONS) as AppLanguage[];

/** Bare device codes that should map onto a regional catalog entry. */
export const DEVICE_LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
${aliases}
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(APP_LANGUAGE_DEFINITIONS, value);
}

/** Walk zh-Hans-CN → zh-Hans → zh so script/region tags still hit the catalog. */
function languageTagCandidates(normalized: string): string[] {
  const parts = normalized.split("-").filter(Boolean);
  const candidates: string[] = [];
  for (let length = parts.length; length >= 1; length -= 1) {
    candidates.push(parts.slice(0, length).join("-"));
  }
  return candidates;
}

/**
 * Map a device locale onto a catalog code, or the fallback when unsupported.
 * \`aliases\` covers bare codes like \`pt\` → \`pt-BR\` when both regional catalogs exist.
 */
export function matchDeviceToAppLanguage<T extends string>(
  deviceLanguageCode: string | undefined,
  supported: readonly T[],
  fallback: T,
  aliases: Readonly<Record<string, string>> = {},
): T {
  if (!deviceLanguageCode) return fallback;
  const normalized = deviceLanguageCode.toLowerCase().replaceAll("_", "-");
  const supportedLower = supported.map((code) => code.toLowerCase());

  for (const candidate of languageTagCandidates(normalized)) {
    const index = supportedLower.indexOf(candidate);
    if (index >= 0) return supported[index]!;
    const aliased = aliases[candidate];
    if (aliased) {
      const aliasIndex = supportedLower.indexOf(aliased.toLowerCase());
      if (aliasIndex >= 0) return supported[aliasIndex]!;
    }
  }
  return fallback;
}

export function buildI18nResources(): Record<string, { translation: typeof locale_en }> {
  return Object.fromEntries(
    APP_LANGUAGES.map((code) => [code, { translation: APP_LANGUAGE_DEFINITIONS[code].translation }]),
  );
}
`;
}

async function generateLanguage(language, leaves, english) {
  const outPath = path.join(localesDir, `${language.code}.json`);
  console.log(`translate ${language.code} → ${language.googleTo}`);
  const tree = structuredClone(english);
  const translatedValues = await translateLeaves(leaves, language.googleTo, language.code);
  translatedValues.forEach((value, index) => {
    setAtPath(tree, leaves[index].path, value);
  });
  await writeFile(outPath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  console.log(`wrote ${outPath}`);
}

async function mapPool(items, concurrency, worker) {
  const queue = [...items];
  const runners = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const english = JSON.parse(await readFile(path.join(localesDir, "en.json"), "utf8"));
  const leaves = collectLeaves(english);
  console.log(`Source leaves: ${leaves.length}`);

  await mkdir(localesDir, { recursive: true });

  const pending = [];
  for (const language of APP_UI_LANGUAGES) {
    if (only && !only.has(language.code)) continue;
    if (language.googleTo == null) {
      console.log(`skip ${language.code} (source/manual)`);
      continue;
    }
    if (!force && (await localeFileExists(language.code))) {
      console.log(`skip ${language.code} (exists, use --force)`);
      continue;
    }
    pending.push(language);
  }

  console.log(`pending translations: ${pending.length} (concurrency ${LANGUAGE_CONCURRENCY})`);
  await mapPool(pending, LANGUAGE_CONCURRENCY, (language) =>
    generateLanguage(language, leaves, english),
  );

  const registered = [];
  for (const language of APP_UI_LANGUAGES) {
    if (await localeFileExists(language.code)) registered.push(language);
  }
  const source = buildI18nLanguagesSource(registered);
  await writeFile(i18nLanguagesPath, source, "utf8");
  console.log(`wrote ${i18nLanguagesPath} (${registered.length} languages)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
