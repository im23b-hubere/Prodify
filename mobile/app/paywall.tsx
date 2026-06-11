import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import type { PurchasesPackage } from "react-native-purchases";
import Purchases from "react-native-purchases";

import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { getExpoPublicRevenueCatApiKey } from "../constants/env";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { syncEntitlement } from "../lib/billing";
import { setDevBillingBypass } from "../lib/devBillingBypass";
import { replaceWithPendingDeepLinkOrDashboard } from "../lib/pendingDeepLink";
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
import { isOfferingsErrorKey, resolveOfferingsLoadError } from "../lib/paywallErrors";

type Variant = "value" | "outcome" | "social_proof";
const WEEKLY_PRODUCT_ID = "prodify_premium_weekly";
const SIX_MONTH_PRODUCT_ID = "prodify_premium_6months";

function packageMatchesProductId(pkg: PurchasesPackage, productId: string): boolean {
  return pkg.product.identifier === productId;
}

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
  const [weeklyPkg, setWeeklyPkg] = useState<PurchasesPackage | null>(null);
  const [sixMonthPkg, setSixMonthPkg] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseEnabled, setPurchaseEnabled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isExpoGo = Constants.appOwnership === "expo";
  /** Dev + Expo Go only: screenshot-friendly layout (no IAP). Never active in release builds. */
  const expoGoPreviewMode = __DEV__ && isExpoGo;

  const appUserId = useMemo(() => (user?.id != null ? String(user.id) : null), [user?.id]);

  const previewWeeklyPrice = t("paywall.expoPreview.weeklyPricePlaceholder");
  const previewSixMonthPrice = t("paywall.expoPreview.sixMonthPricePlaceholder");

  useEffect(() => {
    let cancelled = false;
    async function loadOfferings() {
      try {
        if (expoGoPreviewMode) {
          setPurchaseEnabled(false);
          setWeeklyPkg(null);
          setSixMonthPkg(null);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        const hasApiKey = Boolean(getExpoPublicRevenueCatApiKey());
        if (!hasApiKey) {
          setPurchaseEnabled(false);
          setError(t("paywall.errors.missingConfig"));
          return;
        }
        if (isExpoGo) {
          setPurchaseEnabled(false);
          setError(t("paywall.errors.expoGoNotSupported"));
          return;
        }
        await configureRevenueCat(appUserId ?? undefined);
        const offering = await getDefaultOffering();
        if (cancelled) return;
        const pkgs = offering?.availablePackages ?? [];
        const weekly = pkgs.find((p) => p.packageType === "WEEKLY");
        const sixMonth = pkgs.find((p) => p.packageType === "SIX_MONTH");
        const weeklyById = pkgs.find((p) => packageMatchesProductId(p, WEEKLY_PRODUCT_ID));
        const sixMonthById = pkgs.find((p) => packageMatchesProductId(p, SIX_MONTH_PRODUCT_ID));
        const resolvedWeekly = weekly ?? weeklyById ?? pkgs[0] ?? null;
        const resolvedSixMonth = sixMonth ?? sixMonthById ?? null;
        setWeeklyPkg(resolvedWeekly);
        setSixMonthPkg(resolvedSixMonth);
        setPurchaseEnabled(pkgs.length > 0);
        if (!pkgs.length) {
          setError(t("paywall.errors.storeUnavailable"));
        } else {
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setPurchaseEnabled(false);
        const resolved = resolveOfferingsLoadError(e, t("paywall.errors.loadOfferings"));
        setError(isOfferingsErrorKey(resolved) ? t(`paywall.errors.${resolved}`) : resolved);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOfferings();
    return () => {
      cancelled = true;
    };
  }, [appUserId, expoGoPreviewMode, isExpoGo, reloadKey, t]);

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
      Alert.alert(
        t("paywall.alerts.premiumUnlockedTitle"),
        t("paywall.alerts.premiumUnlockedBody"),
      );
      const exitRoute = resolvePaywallExitRoute(source, Boolean(token));
      if (exitRoute) {
        if (exitRoute === "/(tabs)/dashboard") {
          await replaceWithPendingDeepLinkOrDashboard(router);
        } else {
          router.replace(exitRoute);
        }
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

  async function onSkipSubscriptionForDev() {
    if (!expoGoPreviewMode) return;
    setBusy(true);
    try {
      if (token && appUserId) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: "premium",
          trial_active: true,
          expires_at: expires.toISOString(),
        }).catch(() => undefined);
      }
      await setDevBillingBypass(true);
      const exitRoute = resolvePaywallExitRoute(source, Boolean(token));
      if (exitRoute === "/(tabs)/dashboard") {
        await replaceWithPendingDeepLinkOrDashboard(router);
        return;
      }
      if (exitRoute) {
        router.replace(exitRoute);
        return;
      }
      router.back();
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.card}>
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
            expoGoPreviewMode
              ? t("paywall.cta.startTrialWithPrice", { price: previewSixMonthPrice })
              : sixMonthPkg
                ? t("paywall.cta.startTrialWithPrice", {
                    price: sixMonthPkg.product.priceString,
                  })
                : t("paywall.cta.startTrial")
          }
          onPress={() => void purchasePackage(sixMonthPkg ?? weeklyPkg)}
          disabled={busy || (!purchaseEnabled && !expoGoPreviewMode)}
        />
        <PrimaryButton
          label={
            expoGoPreviewMode
              ? t("paywall.cta.weeklyWithPrice", { price: previewWeeklyPrice })
              : weeklyPkg
                ? t("paywall.cta.weeklyWithPrice", { price: weeklyPkg.product.priceString })
                : t("paywall.cta.weekly")
          }
          onPress={() => void purchasePackage(weeklyPkg)}
          disabled={busy || (!purchaseEnabled && !expoGoPreviewMode)}
        />
        <Pressable
          style={styles.restore}
          onPress={() => void onRestore()}
          disabled={busy || expoGoPreviewMode}
          accessibilityRole="button"
          accessibilityLabel={t("paywall.cta.restore")}
        >
          <Text style={styles.restoreText}>
            {busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.restore")}
          </Text>
        </Pressable>
        {expoGoPreviewMode ? (
          <Pressable
            style={styles.skipDev}
            onPress={() => void onSkipSubscriptionForDev()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("paywall.a11y.skipSubscription")}
          >
            <Text style={styles.skipDevText}>
              {busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.skipSubscriptionDev")}
            </Text>
          </Pressable>
        ) : null}
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
  badge: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  body: { color: colors.textSecondary, ...typography.body },
  restore: { alignItems: "center", paddingVertical: spacing.xs },
  restoreText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  skipDev: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  skipDevText: {
    color: colors.primary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
