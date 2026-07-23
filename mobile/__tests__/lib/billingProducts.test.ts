import {
  PAYWALL_PRODUCT_IDS,
  SIX_MONTH_PRODUCT_ID,
  WEEKLY_PRODUCT_ID,
  isPurchasablePackage,
  resolvePaywallPackages,
} from "../../lib/billingProducts";

function makePackage(input: {
  identifier: string;
  packageType?: string;
  productId: string;
  priceString?: string;
  price?: number;
}) {
  return {
    identifier: input.identifier,
    packageType: input.packageType ?? "CUSTOM",
    product: {
      identifier: input.productId,
      priceString: input.priceString ?? "",
      price: input.price ?? 0,
    },
  };
}

describe("billingProducts", () => {
  it("exports the App Store Connect product identifiers", () => {
    expect(WEEKLY_PRODUCT_ID).toBe("prodify_weekly_access");
    expect(SIX_MONTH_PRODUCT_ID).toBe("prodify_6month_access");
    expect(PAYWALL_PRODUCT_IDS).toEqual([
      "prodify_weekly_access",
      "prodify_6month_access",
    ]);
  });

  it("requires a StoreKit price before treating a package as purchasable", () => {
    expect(
      isPurchasablePackage(
        makePackage({
          identifier: "$rc_weekly",
          productId: WEEKLY_PRODUCT_ID,
        }) as never,
      ),
    ).toBe(false);
    expect(
      isPurchasablePackage(
        makePackage({
          identifier: "$rc_weekly",
          productId: WEEKLY_PRODUCT_ID,
          priceString: "CHF 10.00",
        }) as never,
      ),
    ).toBe(true);
  });

  it("resolves weekly and six-month packages by RevenueCat identifiers", () => {
    const weekly = makePackage({
      identifier: "$rc_weekly",
      packageType: "WEEKLY",
      productId: WEEKLY_PRODUCT_ID,
      priceString: "CHF 10.00",
    });
    const sixMonth = makePackage({
      identifier: "$rc_six_month",
      packageType: "CUSTOM",
      productId: SIX_MONTH_PRODUCT_ID,
      priceString: "CHF 49.99",
    });

    expect(resolvePaywallPackages([weekly, sixMonth] as never)).toEqual({
      weekly,
      sixMonth,
      purchasable: [weekly, sixMonth],
    });
  });
});
