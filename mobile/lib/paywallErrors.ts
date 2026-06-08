/** Map RevenueCat / StoreKit errors to short, actionable paywall copy. */
export function resolveOfferingsLoadError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("configuration") ||
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
