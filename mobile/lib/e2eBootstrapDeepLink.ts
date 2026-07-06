import * as Linking from "expo-linking";

import { extractDeepLinkPath } from "./deepLinkGuard";
import { isE2eModeEnabled } from "./e2eMode";

const BOOTSTRAP_PATH = "e2e/bootstrap";

function readQueryParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

/** Parse query string manually so passwords with `!` are not truncated as URL fragments. */
function queryFromUrl(url: string): Record<string, string> {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) return {};
  const query = url.slice(qIndex + 1);
  const out: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq >= 0 ? part.slice(0, eq) : part;
    const rawVal = eq >= 0 ? part.slice(eq + 1) : "";
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      const value = decodeURIComponent(rawVal.replace(/\+/g, " "));
      if (key) out[key] = value;
    } catch {
      if (rawKey) out[rawKey] = rawVal;
    }
  }
  return out;
}

export function isE2eBootstrapDeepLink(url: string): boolean {
  return isE2eModeEnabled() && extractDeepLinkPath(url) === BOOTSTRAP_PATH;
}

export function parseE2eBootstrapDeepLink(url: string): { email: string; password: string } | null {
  if (!isE2eBootstrapDeepLink(url)) return null;

  const manual = queryFromUrl(url);
  let email = manual.email?.trim() ?? "";
  let password = manual.password ?? "";

  if (!email || !password) {
    const parsed = Linking.parse(url);
    email =
      email || readQueryParam(parsed.queryParams?.email as string | string[] | undefined).trim();
    password =
      password || readQueryParam(parsed.queryParams?.password as string | string[] | undefined);
  }

  if (!email || !password) return null;
  return { email, password };
}
