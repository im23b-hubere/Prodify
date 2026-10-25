import type { PurchasesStoreProduct } from "react-native-purchases";

type PricedProduct = Pick<
  PurchasesStoreProduct,
  "price" | "priceString" | "pricePerWeek" | "pricePerWeekString"
>;

/** The store's own per-week price for a plan ("$2.31"), or its full price if it has none. */
export function perWeekLabel(product: PricedProduct): { amount: string; isPerWeek: boolean } {
  return product.pricePerWeekString
    ? { amount: product.pricePerWeekString, isPerWeek: true }
    : { amount: product.priceString, isPerWeek: false };
}

/** Whole percent the long plan saves per week against paying weekly; null when unknown. */
export function weeklySavingPercent(
  weekly: PricedProduct | undefined,
  longer: PricedProduct | undefined,
): number | null {
  const weeklyRate = weekly?.pricePerWeek ?? weekly?.price;
  const longerRate = longer?.pricePerWeek;
  if (!weeklyRate || !longerRate || weeklyRate <= 0 || longerRate <= 0) return null;
  const saving = Math.round((1 - longerRate / weeklyRate) * 100);
  return saving >= 1 ? saving : null;
}
