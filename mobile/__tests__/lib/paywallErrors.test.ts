import { isPurchaseCancelledError } from "../../lib/paywallErrors";

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
