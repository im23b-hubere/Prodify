import type { PurchasesStoreProduct } from "react-native-purchases";

type PricedProduct = Pick<
  PurchasesStoreProduct,
  "price" | "priceString" | "pricePerWeek" | "pricePerWeekString"
>;

/**
 * The store's weekly rate ("$2.31") as a comparison beneath a plan's billed price, or null when
 * it would only repeat that price. Apple requires the billed amount to stay the prominent one.
 */
export function weeklyEquivalentPrice(product: PricedProduct): string | null {
  const perWeek = product.pricePerWeekString;
  return perWeek && perWeek !== product.priceString ? perWeek : null;
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
