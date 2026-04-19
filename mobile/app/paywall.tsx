import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";
import Purchases from "react-native-purchases";

import { PrimaryButton } from "../components/ui/PrimaryButton";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { syncEntitlement } from "../lib/billing";
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

const copyMap: Record<Variant, { title: string; body: string }> = {
  value: {
    title: "Plan faster, ship more",
    body: "Unlock weekly AI reviews and forecasting to turn raw sessions into clear outcomes.",
  },
  outcome: {
    title: "Stop guessing, start shipping",
    body: "Get coach debriefs and next steps after every session so progress compounds weekly.",
  },
  social_proof: {
    title: "Serious producers stay consistent",
    body: "Join premium challenges and accountability loops used by your most consistent peers.",
  },
};

export default function PaywallScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ variant?: string }>();
  const variant: Variant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";
  const copy = copyMap[variant];
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [yearlyPkg, setYearlyPkg] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appUserId = useMemo(() => (user?.id != null ? String(user.id) : null), [user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadOfferings() {
      if (!appUserId) {
        setLoading(false);
        setError("Sign in required to purchase.");
        return;
      }
      try {
        setLoading(true);
        await configureRevenueCat(appUserId);
        const offering = await getDefaultOffering();
        if (cancelled) return;
        const pkgs = offering?.availablePackages ?? [];
        setMonthlyPkg(pkgs.find((p) => p.packageType === "MONTHLY") ?? pkgs[0] ?? null);
        setYearlyPkg(pkgs.find((p) => p.packageType === "ANNUAL") ?? null);
        if (!pkgs.length) {
          setError("No subscription packages available.");
        } else {
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load offerings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOfferings();
    return () => {
      cancelled = true;
    };
  }, [appUserId]);

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
      Alert.alert("Unavailable", "This package is not available right now.");
      return;
    }
    if (!token || !appUserId) {
      Alert.alert("Sign in required", "Please sign in to continue.");
      return;
    }
    setBusy(true);
    try {
      const res = await Purchases.purchasePackage(pkg);
      if (!isPremiumActive(res.customerInfo)) {
        throw new Error("Purchase did not activate premium entitlement.");
      }
      await syncEntitlement(token, {
        app_user_id: appUserId,
        entitlement: "premium",
        trial_active: isTrialActive(res.customerInfo),
        expires_at: activeEntitlementExpiration(res.customerInfo),
      });
      Alert.alert("Premium unlocked", "Your premium plan is active.");
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Purchase failed.";
      Alert.alert("Purchase failed", message);
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!token || !appUserId) return;
    setBusy(true);
    try {
      const info = await restoreRevenueCatPurchases();
      await syncEntitlement(token, {
        app_user_id: appUserId,
        entitlement: isPremiumActive(info) ? "premium" : "free",
        trial_active: isTrialActive(info),
        expires_at: activeEntitlementExpiration(info),
      });
      await syncBackendFromCustomerInfo();
      Alert.alert(
        "Restore complete",
        isPremiumActive(info) ? "Premium restored." : "No active premium found.",
      );
    } catch (e) {
      Alert.alert(
        "Restore failed",
        e instanceof Error ? e.message : "Could not restore purchases.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.card}>
        <Text style={styles.badge}>Premium</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={
            yearlyPkg
              ? `Start 7-day trial · ${yearlyPkg.product.priceString}/year`
              : "Start 7-day trial"
          }
          onPress={() => void purchasePackage(yearlyPkg ?? monthlyPkg)}
        />
        <PrimaryButton
          label={monthlyPkg ? `Monthly · ${monthlyPkg.product.priceString}` : "Monthly plan"}
          onPress={() => void purchasePackage(monthlyPkg)}
        />
        <Pressable style={styles.restore} onPress={() => void onRestore()} disabled={busy}>
          <Text style={styles.restoreText}>{busy ? "Please wait..." : "Restore purchases"}</Text>
        </Pressable>
        <PrimaryButton label="Not now" onPress={() => router.back()} />
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
  error: { color: colors.danger, ...typography.caption },
  restore: { alignItems: "center", paddingVertical: spacing.xs },
  restoreText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
