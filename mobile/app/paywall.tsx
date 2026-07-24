import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { ErrorState } from "../components/states/ErrorState";
import { PaywallPlansSkeleton } from "../components/states/PaywallPlansSkeleton";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { getExpoPublicRevenueCatApiKey } from "../constants/env";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/client";
import { seedEntitlementCache, syncEntitlement } from "../lib/billing";
import { setDevBillingBypass } from "../lib/devBillingBypass";
import { isE2eModeEnabled } from "../lib/e2eMode";
import { bootstrapPaywall } from "../lib/paywallBootstrap";
import { replaceWithPendingDeepLinkOrDashboard } from "../lib/pendingDeepLink";
import { resolvePaywallExitRoute, type PaywallSource } from "../lib/postAuthNavigation";
import {
  activeEntitlementExpiration,
  getRevenueCatCustomerInfo,
  isPremiumActive,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../lib/revenuecat";
import { loadOnboardingQuiz } from "../lib/onboardingQuiz";
import {
  isPaymentPendingError,
  isPurchaseAlreadyOwnedError,
  isPurchaseCancelledError,
} from "../lib/paywallErrors";

type Variant = "value" | "outcome" | "social_proof";

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut, deleteAccount, refreshUser } = useAuth();
  const params = useLocalSearchParams<{ variant?: string; source?: string }>();
  const source: PaywallSource =
    params.source === "onboarding" || params.source === "post_auth" ? params.source : "in_app";
  const blockExit = source === "post_auth" || source === "onboarding";
  const [allowRemove, setAllowRemove] = useState(false);
  const [pendingExit, setPendingExit] = useState<
    "dashboard" | "login" | "register" | "back" | null
  >(null);
  const unlockAlertPendingRef = useRef(false);

  usePreventRemove(
    blockExit && !allowRemove,
    useCallback(() => {}, []),
  );

  useEffect(() => {
    if (!allowRemove || pendingExit == null) return;
    const exit = pendingExit;
    setPendingExit(null);

    // Brief delay so usePreventRemove releases the screen before programmatic replace.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (exit === "dashboard") {
            await replaceWithPendingDeepLinkOrDashboard(router);
          } else if (exit === "login") {
            router.replace("/(auth)/login");
          } else if (exit === "register") {
            router.replace("/(auth)/register");
          } else if (exit === "back") {
            router.back();
          }
        } finally {
          if (unlockAlertPendingRef.current) {
            unlockAlertPendingRef.current = false;
            Alert.alert(
              t("paywall.alerts.premiumUnlockedTitle"),
              t("paywall.alerts.premiumUnlockedBody"),
            );
          }
        }
      })();
    }, 100);

    return () => clearTimeout(timer);
  }, [allowRemove, pendingExit, router, t]);

  useEffect(() => {
    if (!blockExit) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [blockExit]);

  const variant: Variant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";
  const defaultCopy = useMemo(
    () => ({
      title: t(`paywall.variants.${variant}.title`),
      body: t(`paywall.variants.${variant}.body`),
    }),
    [t, variant],
  );
  const [personalizedCopy, setPersonalizedCopy] = useState<{ title: string; body: string } | null>(
    null,
  );
  const copy = personalizedCopy ?? defaultCopy;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weeklyPkg, setWeeklyPkg] = useState<PurchasesPackage | null>(null);
  const [sixMonthPkg, setSixMonthPkg] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseEnabled, setPurchaseEnabled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isExpoGo = Constants.appOwnership === "expo";
  const e2ePreviewMode = isE2eModeEnabled();
  /** Dev + Expo Go only: screenshot-friendly layout (no IAP). Never active in release builds. */
  const expoGoPreviewMode = e2ePreviewMode || (__DEV__ && isExpoGo);

  const appUserId = useMemo(() => (user?.id != null ? String(user.id) : null), [user?.id]);

  useEffect(() => {
    if (source !== "onboarding") {
      setPersonalizedCopy(null);
      return;
    }
    let cancelled = false;
    void loadOnboardingQuiz().then((quiz) => {
      if (cancelled || !quiz?.producerGoal) return;
      setPersonalizedCopy({
        title: t(`onboarding.quiz.paywall.${quiz.producerGoal}.title`),
        body: t(`onboarding.quiz.paywall.${quiz.producerGoal}.body`, {
          weekly: quiz.weeklyGoal ?? 7,
        }),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [source, t]);

  const previewWeeklyPrice = t("paywall.expoPreview.weeklyPricePlaceholder");
  const previewSixMonthPrice = t("paywall.expoPreview.sixMonthPricePlaceholder");

  const requestPaywallExit = useCallback((exit: "dashboard" | "login" | "register" | "back") => {
    setPendingExit(exit);
    setAllowRemove(true);
  }, []);

  const resolvePendingExitAfterUnlock = useCallback(():
    | "dashboard"
    | "login"
    | "register"
    | "back" => {
    const exitRoute = resolvePaywallExitRoute(source, Boolean(token));
    if (exitRoute === "/(tabs)/dashboard") return "dashboard";
    if (exitRoute === "/(auth)/register") return "register";
    if (exitRoute === "/(auth)/login") return "login";
    return "back";
  }, [source, token]);

  const finalizePremiumUnlock = useCallback(
    async (info: CustomerInfo | null, expiresAt?: string | null) => {
      const resolvedExpires = info ? activeEntitlementExpiration(info) : (expiresAt ?? null);
      if (token) {
        seedEntitlementCache(
          token,
          {
            provider: "revenuecat",
            entitlement: "premium",
            trial_active: false,
            expires_at: resolvedExpires,
          },
          appUserId ? Number.parseInt(appUserId, 10) : null,
        );
      }
      if (token && appUserId) {
        const synced = await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: "premium",
          trial_active: false,
          expires_at: resolvedExpires,
        }).catch(() => null);
        if (!synced || synced.entitlement !== "premium") {
          seedEntitlementCache(
            token,
            {
              provider: "revenuecat",
              entitlement: "premium",
              trial_active: false,
              expires_at: resolvedExpires,
            },
            Number.parseInt(appUserId, 10),
          );
        }
        await refreshUser().catch(() => undefined);
      }
      unlockAlertPendingRef.current = true;
      requestPaywallExit(resolvePendingExitAfterUnlock());
    },
    [appUserId, refreshUser, requestPaywallExit, resolvePendingExitAfterUnlock, token],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadPaywall() {
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
        setError(null);
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

        const result = await bootstrapPaywall({
          token,
          appUserId,
          userIsPremium: Boolean(user?.is_premium),
          t,
        });
        if (cancelled) return;

        if (result.kind === "premium_unlock") {
          await finalizePremiumUnlock(result.customerInfo);
          return;
        }

        if (result.kind === "plans_ready") {
          setWeeklyPkg(result.weekly);
          setSixMonthPkg(result.sixMonth);
          setPurchaseEnabled(result.purchasable.length > 0);
          setError(null);
          return;
        }

        setPurchaseEnabled(false);
        setWeeklyPkg(null);
        setSixMonthPkg(null);
        setError(result.message);
      } catch (e) {
        if (cancelled) return;
        setPurchaseEnabled(false);
        setError(e instanceof Error ? e.message : t("paywall.errors.loadOfferings"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPaywall();
    return () => {
      cancelled = true;
    };
  }, [appUserId, expoGoPreviewMode, finalizePremiumUnlock, isExpoGo, reloadKey, t, token, user?.is_premium]);

  async function recoverExistingSubscription(showFailureAlert: boolean): Promise<boolean> {
    const customerInfo = await getRevenueCatCustomerInfo(appUserId ?? undefined).catch(() => null);
    if (customerInfo && isPremiumActive(customerInfo)) {
      await finalizePremiumUnlock(customerInfo);
      return true;
    }

    const restoredInfo = await restoreRevenueCatPurchases(appUserId ?? undefined).catch(() => null);
    if (restoredInfo && isPremiumActive(restoredInfo)) {
      await finalizePremiumUnlock(restoredInfo);
      return true;
    }

    if (showFailureAlert) {
      Alert.alert(
        t("paywall.alerts.restoreFailedTitle"),
        t("paywall.errors.alreadySubscribedRestoreFailed"),
      );
    }
    return false;
  }

  async function purchasePackage(pkg: PurchasesPackage | null) {
    if (!pkg) {
      Alert.alert(t("paywall.alerts.unavailableTitle"), t("paywall.alerts.unavailableBody"));
      return;
    }
    setBusy(true);
    try {
      const res = await purchaseRevenueCatPackage(pkg, appUserId ?? undefined);
      if (!isPremiumActive(res.customerInfo)) {
        throw new Error(t("paywall.errors.entitlementNotActive"));
      }
      await finalizePremiumUnlock(res.customerInfo);
    } catch (e) {
      if (isPurchaseCancelledError(e)) {
        return;
      }
      if (isPurchaseAlreadyOwnedError(e)) {
        const recovered = await recoverExistingSubscription(true);
        if (recovered) return;
      }
      if (isPaymentPendingError(e)) {
        Alert.alert(
          t("paywall.alerts.purchasePendingTitle"),
          t("paywall.alerts.purchasePendingBody"),
        );
        return;
      }
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
      await setDevBillingBypass(true);
      if (token) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        const expiresAt = expires.toISOString();
        seedEntitlementCache(token, {
          provider: "revenuecat",
          entitlement: "premium",
          trial_active: false,
          expires_at: expiresAt,
        });
      }
      requestPaywallExit(token ? "dashboard" : resolvePendingExitAfterUnlock());
    } finally {
      setBusy(false);
    }
  }

  function confirmLogout() {
    Alert.alert(t("profile.signOutConfirmTitle"), t("profile.signOutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOutConfirmButton"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await signOut();
            } finally {
              requestPaywallExit("login");
            }
          })();
        },
      },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(t("legal.deleteAccount.confirmTitle"), t("legal.deleteAccount.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("legal.deleteAccount.confirmDelete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteAccount();
              requestPaywallExit("login");
            } catch (e) {
              const msg =
                e instanceof ApiError
                  ? e.message
                  : e instanceof Error
                    ? e.message
                    : t("legal.deleteAccount.errorFallback");
              Alert.alert(t("legal.deleteAccount.errorTitle"), msg);
            }
          })();
        },
      },
    ]);
  }

  async function onRestore() {
    setBusy(true);
    try {
      const info = await restoreRevenueCatPurchases(appUserId ?? undefined);
      if (token && appUserId) {
        await syncEntitlement(token, {
          app_user_id: appUserId,
          entitlement: isPremiumActive(info) ? "premium" : "free",
          trial_active: false,
          expires_at: activeEntitlementExpiration(info),
        }).catch(() => undefined);
        if (isPremiumActive(info)) {
          await refreshUser().catch(() => undefined);
        }
      }
      if (isPremiumActive(info)) {
        await finalizePremiumUnlock(info);
        return;
      }
      Alert.alert(
        t("paywall.alerts.restoreCompleteTitle"),
        t("paywall.alerts.restoreCompleteNone"),
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.badge}>{t("paywall.badge")}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body} numberOfLines={3}>
            {copy.body}
          </Text>
          {loading ? (
            <PaywallPlansSkeleton />
          ) : (
            <>
              {error && !expoGoPreviewMode ? (
                <ErrorState
                  title={t("paywall.errorTitle")}
                  message={error}
                  retryLabel={t("common.tryAgain")}
                  onRetry={() => {
                    setReloadKey((prev) => prev + 1);
                  }}
                />
              ) : null}
              {!error || expoGoPreviewMode ? (
                <>
                  <PrimaryButton
                    label={
                      expoGoPreviewMode
                        ? t("paywall.cta.sixMonthWithPrice", { price: previewSixMonthPrice })
                        : sixMonthPkg
                          ? t("paywall.cta.sixMonthWithPrice", {
                              price: sixMonthPkg.product.priceString,
                            })
                          : t("paywall.cta.sixMonth")
                    }
                    onPress={() => void purchasePackage(sixMonthPkg)}
                    disabled={
                      busy ||
                      (!expoGoPreviewMode && !sixMonthPkg) ||
                      (!purchaseEnabled && !expoGoPreviewMode)
                    }
                  />
                  <SecondaryButton
                    label={
                      expoGoPreviewMode
                        ? t("paywall.cta.weeklyWithPrice", { price: previewWeeklyPrice })
                        : weeklyPkg
                          ? t("paywall.cta.weeklyWithPrice", {
                              price: weeklyPkg.product.priceString,
                            })
                          : t("paywall.cta.weekly")
                    }
                    onPress={() => void purchasePackage(weeklyPkg)}
                    disabled={
                      busy ||
                      (!expoGoPreviewMode && !weeklyPkg) ||
                      (!purchaseEnabled && !expoGoPreviewMode)
                    }
                  />
                </>
              ) : null}
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
            </>
          )}
          <View style={styles.footer}>
            <Text style={styles.disclaimer}>{t("paywall.legal.disclaimer")}</Text>
            <View style={styles.legalRow}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("paywall.legal.privacyLink")}
                onPress={() => router.push("/legal/privacy" as never)}
              >
                <Text style={styles.legalLink}>{t("paywall.legal.privacyLink")}</Text>
              </Pressable>
              <Text style={styles.legalSep}>·</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("paywall.legal.termsLink")}
                onPress={() => router.push("/legal/terms" as never)}
              >
                <Text style={styles.legalLink}>{t("paywall.legal.termsLink")}</Text>
              </Pressable>
            </View>
            {token ? (
              <View style={styles.legalRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("paywall.account.signOut")}
                  onPress={confirmLogout}
                  disabled={busy}
                >
                  <Text style={styles.accountActionText}>{t("paywall.account.signOut")}</Text>
                </Pressable>
                <Text style={styles.legalSep}>·</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("paywall.account.deleteAccount")}
                  onPress={confirmDeleteAccount}
                  disabled={busy}
                >
                  <Text style={styles.accountActionDestructive}>
                    {t("paywall.account.deleteAccount")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  badge: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    fontSize: 22,
    lineHeight: 28,
  },
  body: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
  },
  restore: { alignItems: "center", paddingVertical: 2 },
  restoreText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  legalLink: {
    color: colors.primary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
  legalSep: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  accountActionText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
  },
  accountActionDestructive: {
    color: colors.danger,
    fontSize: 11,
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
