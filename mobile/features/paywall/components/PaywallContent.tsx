import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../../constants/theme";
import { paywallStyles as styles } from "../paywall.styles";
import type { PaywallController } from "../usePaywallController";
import type { PaywallHeadline } from "../usePaywallCopy";
import { PaywallBenefits } from "./PaywallBenefits";
import { PaywallFooter } from "./PaywallFooter";
import {
  PaywallPlans,
  planPackage,
  planPurchaseDisabled,
  renewalNote,
  showsPlansError,
  type PlanKind,
} from "./PaywallPlans";
import { PaywallUnlockButton } from "./PaywallUnlockButton";

/** The headline over two lines, its key phrase in Prodify orange. */
function PaywallTitle({ headline }: { headline: PaywallHeadline }) {
  const at = headline.emphasis ? headline.title.indexOf(headline.emphasis) : -1;
  const fit = { numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.75 } as const;
  if (at < 0) {
    return (
      <Text style={styles.title} {...fit}>
        {headline.title}
      </Text>
    );
  }
  return (
    <Text style={styles.title} {...fit}>
      {headline.title.slice(0, at)}
      <Text style={styles.titleAccent}>{headline.emphasis}</Text>
      {headline.title.slice(at + headline.emphasis.length)}
    </Text>
  );
}

type Props = {
  controller: PaywallController;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
};

/**
 * Premium: why it's worth it, what it unlocks, the two plans, and a docked unlock button
 * with restore and the legal links beneath.
 */
export function PaywallContent({ controller, onOpenPrivacy, onOpenTerms }: Props) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlanKind>("sixMonth");
  const pkg = planPackage(controller, plan);
  const hasPlansError = showsPlansError(controller);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,61,0,0.16)", "rgba(255,61,0,0)"]}
        style={styles.glow}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(280)}>
          <Text style={styles.eyebrow}>{t("paywall.eyebrow")}</Text>
          <PaywallTitle headline={controller.copy} />
        </Animated.View>
        <PaywallBenefits />
        <PaywallPlans controller={controller} selected={plan} onSelect={setPlan} />
        {hasPlansError ? null : (
          <View style={styles.reassurance}>
            <ShieldCheck size={15} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.reassuranceText}>{t("paywall.cancelAnytime")}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.dock}>
        {hasPlansError ? null : (
          <PaywallUnlockButton
            label={t("paywall.cta.unlock")}
            busy={controller.busy}
            disabled={planPurchaseDisabled(pkg, controller)}
            onPress={() => void controller.purchasePackage(pkg)}
          />
        )}
        <PaywallFooter
          renewalNote={renewalNote(pkg, plan, t)}
          busy={controller.busy}
          restoreDisabled={controller.busy || controller.expoGoPreviewMode}
          onRestore={() => void controller.onRestore()}
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onDeleteAccount={
            controller.canDeleteAccount ? controller.confirmDeleteAccount : undefined
          }
        />
        {controller.expoGoPreviewMode ? (
          <Pressable
            style={styles.skipDev}
            onPress={() => void controller.onSkipSubscriptionForDev()}
            disabled={controller.busy}
            accessibilityRole="button"
            accessibilityLabel={t("paywall.a11y.skipSubscription")}
          >
            <Text style={styles.skipDevText}>
              {controller.busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.skipSubscriptionDev")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
