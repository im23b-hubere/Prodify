import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { PurchasesPackage } from "react-native-purchases";
import { View } from "react-native";

import { ErrorState } from "../../../components/states/ErrorState";
import { paywallStyles as styles } from "../paywall.styles";
import { weeklyEquivalentPrice, weeklySavingPercent } from "../paywallPricing";
import type { PaywallController } from "../usePaywallController";
import { PaywallPlanTile } from "./PaywallPlanTile";

export type PlanKind = "weekly" | "sixMonth";

type Props = {
  controller: PaywallController;
  selected: PlanKind;
  onSelect: (kind: PlanKind) => void;
};

/** The two plans next to each other, both quoted per week so the longer one's saving shows. */
export function PaywallPlans({ controller, selected, onSelect }: Props) {
  const { t } = useTranslation();

  if (showsPlansError(controller)) {
    return (
      <ErrorState
        title={t("paywall.errorTitle")}
        message={controller.error ?? ""}
        retryLabel={t("common.tryAgain")}
        onRetry={controller.retry}
      />
    );
  }

  const saving = weeklySavingPercent(
    controller.weeklyPkg?.product,
    controller.sixMonthPkg?.product,
  );
  const badges: Record<PlanKind, string | null> = {
    weekly: null,
    sixMonth:
      saving != null ? t("paywall.cta.discount", { discount: saving }) : t("paywall.cta.bestValue"),
  };

  return (
    <View style={styles.plans}>
      {(["weekly", "sixMonth"] as const).map((kind) => (
        <PaywallPlanTile
          key={kind}
          title={t(`paywall.cta.${kind}`)}
          {...tilePricing(controller, kind, t)}
          badge={badges[kind]}
          selected={selected === kind}
          disabled={controller.busy}
          accessibilityLabel={tileAccessibilityLabel(controller, kind, t)}
          onSelect={() => onSelect(kind)}
        />
      ))}
    </View>
  );
}

export function showsPlansError(controller: PaywallController) {
  return Boolean(controller.error && !controller.expoGoPreviewMode);
}

export function planPackage(controller: PaywallController, kind: PlanKind) {
  return kind === "sixMonth" ? controller.sixMonthPkg : controller.weeklyPkg;
}

/** The renewal terms for the selected plan with what it bills; general until a price is known. */
export function renewalNote(pkg: PurchasesPackage | null, kind: PlanKind, t: TFunction) {
  const price = pkg?.product.priceString;
  if (!price) return t("paywall.legal.disclaimer");
  const key = kind === "sixMonth" ? "paywall.legal.renewalSixMonth" : "paywall.legal.renewalWeekly";
  return t(key, { price });
}

export function planPurchaseDisabled(pkg: PurchasesPackage | null, controller: PaywallController) {
  if (controller.busy) return true;
  if (controller.expoGoPreviewMode) return false;
  return !pkg || !controller.purchaseEnabled;
}

function previewPrice(controller: PaywallController, kind: PlanKind) {
  return kind === "sixMonth" ? controller.previewSixMonthPrice : controller.previewWeeklyPrice;
}

/** What a tile shows: the amount the store bills, and beneath it a smaller caption. */
function tilePricing(controller: PaywallController, kind: PlanKind, t: TFunction) {
  if (controller.expoGoPreviewMode) return { price: previewPrice(controller, kind), caption: "" };
  if (controller.loading) return { price: "…", caption: t("common.loading") };
  const product = planPackage(controller, kind)?.product;
  if (!product) return { price: "—", caption: t("paywall.plan.unavailable") };
  if (kind === "weekly") return { price: product.priceString, caption: t("paywall.plan.perWeek") };
  const weeklyEquivalent = weeklyEquivalentPrice(product);
  return {
    price: product.priceString,
    caption: weeklyEquivalent
      ? t("paywall.plan.weeklyEquivalent", { price: weeklyEquivalent })
      : t("paywall.plan.everySixMonths"),
  };
}

function tileAccessibilityLabel(controller: PaywallController, kind: PlanKind, t: TFunction) {
  const price = controller.expoGoPreviewMode
    ? previewPrice(controller, kind)
    : planPackage(controller, kind)?.product.priceString;
  return price ? t(`paywall.cta.${kind}WithPrice`, { price }) : t(`paywall.cta.${kind}`);
}
