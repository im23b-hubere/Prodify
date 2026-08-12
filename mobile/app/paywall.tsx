import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/states/ErrorState";
import { PaywallPlansSkeleton } from "../components/states/PaywallPlansSkeleton";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { paywallStyles as styles } from "../features/paywall/paywall.styles";
import { usePaywallController } from "../features/paywall/usePaywallController";
import { useAuth } from "../context/AuthContext";

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const {
    copy,
    loading,
    busy,
    weeklyPkg,
    sixMonthPkg,
    error,
    purchaseEnabled,
    expoGoPreviewMode,
    previewWeeklyPrice,
    previewSixMonthPrice,
    retry,
    purchasePackage,
    onRestore,
    onSkipSubscriptionForDev,
    confirmLogout,
    confirmDeleteAccount,
  } = usePaywallController();

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
                  onRetry={retry}
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
