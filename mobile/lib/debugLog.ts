/**
 * Dev-only structured logging. Never pass tokens, passwords, or refresh strings.
 */
const PREFIX = "[Prodify]";

export type DebugMeta = Record<string, string | number | boolean | null | undefined>;

export function debugLog(scope: string, message: string, meta?: DebugMeta): void {
  if (!__DEV__) return;
  const parts = [PREFIX, scope, message];
  if (meta && Object.keys(meta).length > 0) {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      const key = k.toLowerCase();
      if (
        key.includes("token") ||
        key.includes("password") ||
        key.includes("secret") ||
        key.includes("authorization")
      ) {
        safe[k] = "[redacted]";
      } else {
        safe[k] = v;
      }
    }
    parts.push(JSON.stringify(safe));
  }
  if (typeof console !== "undefined" && typeof console.log === "function") {
    console.log(parts.join(" "));
  }
}

export function debugNav(message: string, meta?: DebugMeta): void {
  debugLog("nav", message, meta);
}
