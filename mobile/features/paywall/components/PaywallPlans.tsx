import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { PurchasesPackage } from "react-native-purchases";
import { View } from "react-native";

import { ErrorState } from "../../../components/states/ErrorState";
import { paywallStyles as styles } from "../paywall.styles";
import { perWeekLabel, weeklySavingPercent } from "../paywallPricing";
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
          {...tilePrice(controller, kind, t)}
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

export function planPurchaseDisabled(pkg: PurchasesPackage | null, controller: PaywallController) {
  if (controller.busy) return true;
  if (controller.expoGoPreviewMode) return false;
  return !pkg || !controller.purchaseEnabled;
}

function previewPrice(controller: PaywallController, kind: PlanKind) {
  return kind === "sixMonth" ? controller.previewSixMonthPrice : controller.previewWeeklyPrice;
}

/** What a tile shows: the per-week amount and, beneath it, what the store actually charges. */
function tilePrice(controller: PaywallController, kind: PlanKind, t: TFunction) {
  if (controller.expoGoPreviewMode) {
    return { amount: previewPrice(controller, kind), isPerWeek: false, billing: "" };
  }
  if (controller.loading) return { amount: "…", isPerWeek: false, billing: t("common.loading") };
  const product = planPackage(controller, kind)?.product;
  if (!product) return { amount: "—", isPerWeek: false, billing: t("paywall.plan.unavailable") };
  const { amount, isPerWeek } = perWeekLabel(product);
  const billingKey =
    kind === "sixMonth" ? "paywall.plan.billedSixMonth" : "paywall.plan.billedWeekly";
  return { amount, isPerWeek, billing: t(billingKey, { price: product.priceString }) };
}

function tileAccessibilityLabel(controller: PaywallController, kind: PlanKind, t: TFunction) {
  const price = controller.expoGoPreviewMode
    ? previewPrice(controller, kind)
    : planPackage(controller, kind)?.product.priceString;
  return price ? t(`paywall.cta.${kind}WithPrice`, { price }) : t(`paywall.cta.${kind}`);
}
