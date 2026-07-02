/** Map RevenueCat / StoreKit errors to short, actionable paywall copy. */
export function resolveOfferingsLoadError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("configuration") ||
    normalized.includes("singleton instance") ||
    normalized.includes("configure purchases") ||
    normalized.includes("app store connect") ||
    normalized.includes("storekit") ||
    normalized.includes("could not be fetched") ||
    normalized.includes("offerings-empty")
  ) {
    return "appleProductsUnavailable";
  }

  return message.trim() || fallback;
}

export function isOfferingsErrorKey(value: string): boolean {
  return value === "appleProductsUnavailable";
}

/** True when the user dismissed the App Store purchase sheet (not a real failure). */
export function isPurchaseCancelledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  if (record.userCancelled === true) return true;
  const code = String(record.code ?? "").toUpperCase();
  if (code.includes("CANCEL")) return true;
  if (code.includes("PAYMENT_PENDING")) return false;
  const message = String(record.message ?? (error instanceof Error ? error.message : "")).toLowerCase();
  return (
    message.includes("purchase was cancelled") ||
    message.includes("purchase was canceled") ||
    message.includes("user cancelled") ||
    message.includes("user canceled")
  );
}
