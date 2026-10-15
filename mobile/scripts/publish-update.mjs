/**
 * Publish an OTA update to production store builds.
 *
 *   npm run update:production -- "Paywall: detect existing subscribers"
 *   npm run update:production -- --check   (validate only, publishes nothing)
 *
 * Uses only the EAS "production" environment (never the local .env) and refuses to publish when
 * the resulting config would not match the store builds.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { findReleaseConfigProblems } = require("./releaseConfigCheck.js");

const ENVIRONMENT = "production";
const CHANNEL = "production";

function runEas(args, env = process.env) {
  return spawnSync("eas", args, { stdio: "inherit", shell: true, env });
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function parseDotenv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function pullEasEnvironment() {
  const directory = mkdtempSync(join(tmpdir(), "prodify-eas-env-"));
  const path = join(directory, ".env");
  try {
    const result = runEas([
      "env:pull",
      "--environment",
      ENVIRONMENT,
      "--path",
      `"${path}"`,
      "--non-interactive",
    ]);
    if (result.status !== 0) fail(`Could not pull the EAS "${ENVIRONMENT}" environment.`);
    return parseDotenv(readFileSync(path, "utf8"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function resolveAppConfig(env) {
  const originalEnv = process.env;
  process.env = { ...env };
  try {
    return require("../app.config.js")({ config: {} });
  } finally {
    process.env = originalEnv;
  }
}

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const message = args
  .filter((arg) => arg !== "--check")
  .join(" ")
  .trim();
if (!checkOnly && !message) {
  fail('Pass an update message, e.g. npm run update:production -- "Fix paywall"');
}

const releaseEnv = { ...process.env, ...pullEasEnvironment(), EXPO_NO_DOTENV: "1" };
const problems = findReleaseConfigProblems({
  config: resolveAppConfig(releaseEnv),
  env: releaseEnv,
});
if (problems.length > 0) {
  fail(
    `Refusing to publish. Fix the EAS "${ENVIRONMENT}" environment:\n  - ${problems.join("\n  - ")}`,
  );
}
if (checkOnly) {
  console.log(`\n✔ EAS "${ENVIRONMENT}" environment is ready for an OTA update.`);
  process.exit(0);
}

const result = runEas(
  [
    "update",
    "--channel",
    CHANNEL,
    "--environment",
    ENVIRONMENT,
    "--message",
    JSON.stringify(message),
    "--non-interactive",
  ],
  releaseEnv,
);
process.exit(result.status ?? 1);
