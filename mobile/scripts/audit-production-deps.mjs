import { spawnSync } from "node:child_process";

const allowedBuildOnlyAdvisories = new Set([
  "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
  "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq",
]);

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : "npm";
const args = npmCli
  ? [npmCli, "audit", "--omit=dev", "--json"]
  : ["audit", "--omit=dev", "--json"];
const result = spawnSync(command, args, {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (!result.stdout.trim()) {
  process.stderr.write(result.stderr || "npm audit produced no JSON output.\n");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  process.stderr.write("Could not parse npm audit JSON output.\n");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};

function advisories(packageName, seen = new Set()) {
  if (seen.has(packageName)) return new Map();
  seen.add(packageName);
  const entry = vulnerabilities[packageName];
  const found = new Map();
  for (const via of entry?.via ?? []) {
    if (typeof via === "string") {
      for (const [url, severity] of advisories(via, seen)) found.set(url, severity);
    } else if (typeof via?.url === "string") {
      found.set(via.url, via.severity ?? "unknown");
    }
  }
  return found;
}

const blocked = [];
const accepted = new Set();
for (const [packageName, entry] of Object.entries(vulnerabilities)) {
  if (entry.severity !== "high" && entry.severity !== "critical") continue;
  const packageAdvisories = advisories(packageName);
  const severeUrls = [...packageAdvisories]
    .filter(([, severity]) => severity === "high" || severity === "critical")
    .map(([url]) => url);
  const isAccepted =
    severeUrls.length > 0 && severeUrls.every((url) => allowedBuildOnlyAdvisories.has(url));
  if (!isAccepted) {
    blocked.push({ packageName, severity: entry.severity, urls: severeUrls });
  } else {
    for (const url of severeUrls) accepted.add(url);
  }
}

if (blocked.length > 0) {
  console.error("Unaccepted high/critical production dependency vulnerabilities:");
  for (const item of blocked) {
    console.error(`- ${item.packageName} (${item.severity}): ${item.urls.join(", ") || "unknown advisory"}`);
  }
  process.exit(1);
}

console.log("No unaccepted high or critical production dependency vulnerabilities found.");
if (accepted.size > 0) {
  console.log("Accepted build-only Metro image parser advisories:");
  for (const url of accepted) console.log(`- ${url}`);
}
