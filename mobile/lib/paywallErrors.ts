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

function purchaseErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return String((error as Record<string, unknown>).code ?? "").toUpperCase();
}

function purchaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (!error || typeof error !== "object") return String(error ?? "").toLowerCase();
  return String((error as Record<string, unknown>).message ?? "").toLowerCase();
}

/** StoreKit/RevenueCat can throw this when the Apple ID already owns the subscription. */
export function isPurchaseAlreadyOwnedError(error: unknown): boolean {
  const code = purchaseErrorCode(error);
  const message = purchaseErrorMessage(error);
  return (
    code.includes("PRODUCT_ALREADY_PURCHASED") ||
    code.includes("PURCHASE_ALREADY") ||
    code.includes("ALREADY_PURCHASED") ||
    code.includes("RECEIPT_ALREADY_IN_USE") ||
    message.includes("already subscribed") ||
    message.includes("already active") ||
    message.includes("already purchased") ||
    message.includes("currently subscribed") ||
    message.includes("subscription is already active") ||
    message.includes("receipt is already in use")
  );
}

export function isPaymentPendingError(error: unknown): boolean {
  const code = purchaseErrorCode(error);
  const message = purchaseErrorMessage(error);
  return code.includes("PAYMENT_PENDING") || message.includes("payment is pending");
}
