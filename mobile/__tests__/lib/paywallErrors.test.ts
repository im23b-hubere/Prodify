import {
  isPaymentPendingError,
  isPurchaseAlreadyOwnedError,
  isPurchaseCancelledError,
} from "../../lib/paywallErrors";

describe("isPurchaseCancelledError", () => {
  it("returns true for RevenueCat userCancelled flag", () => {
    expect(isPurchaseCancelledError({ userCancelled: true })).toBe(true);
  });

  it("returns true for cancel error codes and messages", () => {
    expect(isPurchaseCancelledError({ code: "PURCHASE_CANCELLED" })).toBe(true);
    expect(isPurchaseCancelledError(new Error("Purchase was cancelled"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPurchaseCancelledError(new Error("Network request failed"))).toBe(false);
    expect(isPurchaseCancelledError(null)).toBe(false);
  });
});

describe("isPurchaseAlreadyOwnedError", () => {
  it("returns true for RevenueCat and StoreKit already-owned errors", () => {
    expect(isPurchaseAlreadyOwnedError({ code: "PRODUCT_ALREADY_PURCHASED" })).toBe(true);
    expect(isPurchaseAlreadyOwnedError(new Error("You are already subscribed"))).toBe(true);
    expect(isPurchaseAlreadyOwnedError(new Error("Receipt is already in use"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPurchaseAlreadyOwnedError(new Error("Network request failed"))).toBe(false);
  });
});

describe("isPaymentPendingError", () => {
  it("detects pending payments", () => {
    expect(isPaymentPendingError({ code: "PAYMENT_PENDING" })).toBe(true);
    expect(isPaymentPendingError(new Error("Payment is pending approval"))).toBe(true);
  });
});
