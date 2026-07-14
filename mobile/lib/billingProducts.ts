import type { PurchasesPackage } from "react-native-purchases";

/** App Store / RevenueCat product identifiers (must match App Store Connect). */
export const WEEKLY_PRODUCT_ID = "prodify_weekly_access";
export const SIX_MONTH_PRODUCT_ID = "prodify_6month_access";

export const PAYWALL_PRODUCT_IDS = [WEEKLY_PRODUCT_ID, SIX_MONTH_PRODUCT_ID] as const;

const WEEKLY_PACKAGE_IDENTIFIERS = new Set([
  "$rc_weekly",
  "weekly",
  "$rc_weekly_access",
]);
const SIX_MONTH_PACKAGE_IDENTIFIERS = new Set([
  "$rc_six_month",
  "6-months",
  "six_month",
  "$rc_six_month_access",
]);

function packageMatchesProductId(pkg: PurchasesPackage, productId: string): boolean {
  return pkg.product.identifier === productId;
}

function packageMatchesIdentifier(pkg: PurchasesPackage, identifiers: Set<string>): boolean {
  const normalized = pkg.identifier.trim().toLowerCase();
  return identifiers.has(normalized);
}

/** True when StoreKit returned a product Apple can sell in this build. */
export function isPurchasablePackage(pkg: PurchasesPackage): boolean {
  const productId = pkg.product?.identifier?.trim();
  if (!productId) return false;
  const priceString = pkg.product.priceString?.trim();
  if (priceString) return true;
  return Number.isFinite(pkg.product.price) && pkg.product.price > 0;
}

export type ResolvedPaywallPackages = {
  weekly: PurchasesPackage | null;
  sixMonth: PurchasesPackage | null;
  purchasable: PurchasesPackage[];
};

/** Map RevenueCat offering packages to weekly / 6-month buttons. */
export function resolvePaywallPackages(packages: PurchasesPackage[]): ResolvedPaywallPackages {
  const purchasable = packages.filter(isPurchasablePackage);
  const weekly =
    purchasable.find((pkg) => pkg.packageType === "WEEKLY") ??
    purchasable.find((pkg) => packageMatchesIdentifier(pkg, WEEKLY_PACKAGE_IDENTIFIERS)) ??
    purchasable.find((pkg) => packageMatchesProductId(pkg, WEEKLY_PRODUCT_ID)) ??
    null;
  const sixMonth =
    purchasable.find((pkg) => pkg.packageType === "SIX_MONTH") ??
    purchasable.find((pkg) => packageMatchesIdentifier(pkg, SIX_MONTH_PACKAGE_IDENTIFIERS)) ??
    purchasable.find((pkg) => packageMatchesProductId(pkg, SIX_MONTH_PRODUCT_ID)) ??
    null;

  return { weekly, sixMonth, purchasable };
}
