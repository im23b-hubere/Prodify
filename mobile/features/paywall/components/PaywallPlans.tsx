import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { PurchasesPackage } from "react-native-purchases";
import { Pressable, Text } from "react-native";

import { ErrorState } from "../../../components/states/ErrorState";
import { PaywallPlansSkeleton } from "../../../components/states/PaywallPlansSkeleton";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../../components/ui/SecondaryButton";
import { paywallStyles as styles } from "../paywall.styles";
import type { PaywallController } from "../usePaywallController";

type Props = { controller: PaywallController };

export function PaywallPlans({ controller }: Props) {
  const { t } = useTranslation();
  if (controller.loading) return <PaywallPlansSkeleton />;
  const showError = Boolean(controller.error && !controller.expoGoPreviewMode);
  return (
    <>
      {showError ? (
        <ErrorState
          title={t("paywall.errorTitle")}
          message={controller.error ?? ""}
          retryLabel={t("common.tryAgain")}
          onRetry={controller.retry}
        />
      ) : (
        <PlanButtons controller={controller} />
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
    </>
  );
}

function PlanButtons({ controller }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <PrimaryButton
        label={planLabel({
          pkg: controller.sixMonthPkg,
          previewPrice: controller.previewSixMonthPrice,
          kind: "sixMonth",
          previewMode: controller.expoGoPreviewMode,
          t,
        })}
        onPress={() => void controller.purchasePackage(controller.sixMonthPkg)}
        disabled={planDisabled(controller.sixMonthPkg, controller)}
      />
      <SecondaryButton
        label={planLabel({
          pkg: controller.weeklyPkg,
          previewPrice: controller.previewWeeklyPrice,
          kind: "weekly",
          previewMode: controller.expoGoPreviewMode,
          t,
        })}
        onPress={() => void controller.purchasePackage(controller.weeklyPkg)}
        disabled={planDisabled(controller.weeklyPkg, controller)}
      />
    </>
  );
}

type PlanKind = "weekly" | "sixMonth";

type PlanLabelOptions = {
  pkg: PurchasesPackage | null;
  previewPrice: string;
  kind: PlanKind;
  previewMode: boolean;
  t: TFunction;
};

export function planLabel({ pkg, previewPrice, kind, previewMode, t }: PlanLabelOptions) {
  if (previewMode) return t(`paywall.cta.${kind}WithPrice`, { price: previewPrice });
  if (pkg) return t(`paywall.cta.${kind}WithPrice`, { price: pkg.product.priceString });
  return t(`paywall.cta.${kind}`);
}

function planDisabled(pkg: PurchasesPackage | null, controller: PaywallController) {
  if (controller.busy) return true;
  if (controller.expoGoPreviewMode) return false;
  return !pkg || !controller.purchaseEnabled;
}
