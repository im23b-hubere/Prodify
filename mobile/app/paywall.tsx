import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";
import Purchases from "react-native-purchases";

import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { IconButton } from "../components/ui/IconButton";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { syncEntitlement } from "../lib/billing";
import { resolvePaywallExitRoute, type PaywallSource } from "../lib/postAuthNavigation";
import {
  activeEntitlementExpiration,
  configureRevenueCat,
  getDefaultOffering,
  getRevenueCatCustomerInfo,
  isPremiumActive,
  isTrialActive,
  restoreRevenueCatPurchases,
} from "../lib/revenuecat";

type Variant = "value" | "outcome" | "social_proof";

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ variant?: string; source?: string }>();
  const source: PaywallSource =
    params.source === "onboarding" || params.source === "post_auth" ? params.source : "in_app";
  const variant: Variant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";
  const copy = {
    title: t(`paywall.variants.${variant}.title`),
    body: t(`paywall.variants.${variant}.body`),
  };
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [yearlyPkg, setYearlyPkg] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseEnabled, setPurchaseEnabled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const appUserId = useMemo(() => (user?.id != null ? String(user.id) : null), [user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadOfferings() {
      try {
        setLoading(true);
        await configureRevenueCat(appUserId ?? undefined);
        const offering = await getDefaultOffering();
        if (cancelled) return;
        const pkgs = offering?.availablePackages ?? [];
        setMonthlyPkg(pkgs.find((p) => p.packageType === "MONTHLY") ?? pkgs[0] ?? null);
        setYearlyPkg(pkgs.find((p) => p.packageType === "ANNUAL") ?? null);
        setPurchaseEnabled(pkgs.length > 0);
        if (!pkgs.length) {
          setError(t("paywall.errors.storeUnavailable"));
        } else {
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setPurchaseEnabled(false);
        setError(e instanceof Error ? e.message : t("paywall.errors.loadOfferings"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOfferings();
    return () => {
      cancelled = true;
    };
  }, [appUserId, reloadKey, t]);

  async function syncBackendFromCustomerInfo() {
    if (!token || !appUserId) return;
    const info = await getRevenueCatCustomerInfo();
    await syncEntitlement(token, {
      app_user_id: appUserId,
      entitlement: isPremiumActive(info) ? "premium" : "free",
      trial_active: isTrialActive(info),
      expires_at: activeEntitlementExpiration(info),
    });
  }

  async function purchasePackage(pkg: PurchasesPackage | null) {
    if (!pkg) {
      Alert.alert(t("paywall.alerts.unavailableTitle"), t("paywall.alerts.unavailableBody"));
      return;
    }
    setBusy(true);
    try {
      const res = await Purchases.purchasePackage(pkg);
      if (!isPremiumActive(res.customerInfo)) {
        throw new Error(t("paywall.errors.entitlementNotActive"));
      }
      if (token && appUserId) {
        await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: "premium",
          trial_active: isTrialActive(res.customerInfo),
          expires_at: activeEntitlementExpiration(res.customerInfo),
        });
      }
      Alert.alert(t("paywall.alerts.premiumUnlockedTitle"), t("paywall.alerts.premiumUnlockedBody"));
      const exitRoute = resolvePaywallExitRoute(source, Boolean(token));
      if (exitRoute) {
        router.replace(exitRoute);
        return;
      }
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("paywall.errors.purchaseFailed");
      Alert.alert(t("paywall.alerts.purchaseFailedTitle"), message);
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setBusy(true);
    try {
      const info = await restoreRevenueCatPurchases();
      if (token && appUserId) {
        await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: isPremiumActive(info) ? "premium" : "free",
          trial_active: isTrialActive(info),
          expires_at: activeEntitlementExpiration(info),
        });
        await syncBackendFromCustomerInfo();
      }
      Alert.alert(
        t("paywall.alerts.restoreCompleteTitle"),
        isPremiumActive(info)
          ? t("paywall.alerts.restoreCompletePremium")
          : t("paywall.alerts.restoreCompleteNone"),
      );
    } catch (e) {
      Alert.alert(
        t("paywall.alerts.restoreFailedTitle"),
        e instanceof Error ? e.message : t("paywall.errors.restoreFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  const handleClose = () => {
    const exitRoute = resolvePaywallExitRoute(source, Boolean(token));
    if (exitRoute) {
      router.replace(exitRoute);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.card}>
        <View style={styles.closeButton}>
          <IconButton
            icon="×"
            onPress={handleClose}
            accessibilityLabel={t("paywall.a11y.skipSubscription")}
          />
        </View>
        <Text style={styles.badge}>{t("paywall.badge")}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {loading ? <LoadingState message={t("paywall.loadingOfferings")} /> : null}
        {error ? (
          <ErrorState
            title={t("paywall.errorTitle")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => {
              setReloadKey((prev) => prev + 1);
            }}
          />
        ) : null}
        <PrimaryButton
          label={
            yearlyPkg
              ? t("paywall.cta.startTrialWithPrice", { price: `${yearlyPkg.product.priceString}/year` })
              : t("paywall.cta.startTrial")
          }
          onPress={() => void purchasePackage(yearlyPkg ?? monthlyPkg)}
          disabled={!purchaseEnabled || busy}
        />
        <PrimaryButton
          label={
            monthlyPkg
              ? t("paywall.cta.monthlyWithPrice", { price: monthlyPkg.product.priceString })
              : t("paywall.cta.monthly")
          }
          onPress={() => void purchasePackage(monthlyPkg)}
          disabled={!purchaseEnabled || busy}
        />
        <Pressable
          style={styles.restore}
          onPress={() => void onRestore()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("paywall.cta.restore")}
        >
          <Text style={styles.restoreText}>
            {busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.restore")}
          </Text>
        </Pressable>
        <PrimaryButton
          label={t("paywall.cta.notNow")}
          onPress={handleClose}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  closeButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
  },
  badge: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  body: { color: colors.textSecondary, ...typography.body },
  restore: { alignItems: "center", paddingVertical: spacing.xs },
  restoreText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
