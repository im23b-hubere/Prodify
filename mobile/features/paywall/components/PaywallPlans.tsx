import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { PurchasesPackage } from "react-native-purchases";
import { Pressable, Text, View } from "react-native";

import { ErrorState } from "../../../components/states/ErrorState";
import { PaywallPlansSkeleton } from "../../../components/states/PaywallPlansSkeleton";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { paywallStyles as styles } from "../paywall.styles";
import type { PaywallController } from "../usePaywallController";
import { PaywallPlanOption } from "./PaywallPlanOption";

type PlanKind = "weekly" | "sixMonth";
type Props = { controller: PaywallController };

export function PaywallPlans({ controller }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<PlanKind>("sixMonth");

  if (controller.loading) return <PaywallPlansSkeleton />;

  const showError = Boolean(controller.error && !controller.expoGoPreviewMode);
  const selectedPkg = selected === "sixMonth" ? controller.sixMonthPkg : controller.weeklyPkg;

  return (
    <View style={styles.plans}>
      {showError ? (
        <ErrorState
          title={t("paywall.errorTitle")}
          message={controller.error ?? ""}
          retryLabel={t("common.tryAgain")}
          onRetry={controller.retry}
        />
      ) : (
        <>
          <PaywallPlanOption
            index={0}
            period={t("paywall.cta.sixMonth")}
            price={planPrice(controller, "sixMonth")}
            badge={t("paywall.cta.bestValue")}
            selected={selected === "sixMonth"}
            disabled={controller.busy}
            accessibilityLabel={planAccessibilityLabel(controller, "sixMonth", t)}
            onPress={() => setSelected("sixMonth")}
          />
          <PaywallPlanOption
            index={1}
            period={t("paywall.cta.weekly")}
            price={planPrice(controller, "weekly")}
            selected={selected === "weekly"}
            disabled={controller.busy}
            accessibilityLabel={planAccessibilityLabel(controller, "weekly", t)}
            onPress={() => setSelected("weekly")}
          />
          <View style={styles.continueWrap}>
            <PrimaryButton
              label={controller.busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.continue")}
              loading={controller.busy}
              onPress={() => void controller.purchasePackage(selectedPkg)}
              disabled={planDisabled(selectedPkg, controller)}
              accessibilityLabel={t("paywall.cta.continue")}
            />
          </View>
        </>
      )}
      <Pressable
        style={styles.restore}
        onPress={() => void controller.onRestore()}
        disabled={controller.busy || controller.expoGoPreviewMode}
        accessibilityRole="button"
        accessibilityLabel={t("paywall.cta.restore")}
      >
        <Text style={styles.restoreText}>
          {controller.busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.restore")}
        </Text>
      </Pressable>
    </View>
  );
}

function planPrice(controller: PaywallController, kind: PlanKind): string | null {
  if (controller.expoGoPreviewMode) {
    return kind === "sixMonth" ? controller.previewSixMonthPrice : controller.previewWeeklyPrice;
  }
  const pkg = kind === "sixMonth" ? controller.sixMonthPkg : controller.weeklyPkg;
  return pkg?.product.priceString ?? null;
}

function planAccessibilityLabel(controller: PaywallController, kind: PlanKind, t: TFunction): string {
  const price = planPrice(controller, kind);
  const priced = price ? t(`paywall.cta.${kind}WithPrice`, { price }) : t(`paywall.cta.${kind}`);
  return kind === "sixMonth" ? `${t("paywall.cta.bestValue")}. ${priced}` : priced;
}

function planDisabled(pkg: PurchasesPackage | null, controller: PaywallController) {
  if (controller.busy) return true;
  if (controller.expoGoPreviewMode) return false;
  return !pkg || !controller.purchaseEnabled;
}
