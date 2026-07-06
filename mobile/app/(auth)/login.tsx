import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { useAuth } from "../../context/AuthContext";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ONBOARDING_COMPLETE_KEY, WEEKLY_GOAL_CONFIGURED_KEY } from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { ApiError } from "../../lib/client";
import { getE2eTestCredentials } from "../../lib/e2eCredentials";
import { isE2eModeEnabled } from "../../lib/e2eMode";
import { replaceWithPendingDeepLinkOrDashboard } from "../../lib/pendingDeepLink";
import { resolvePostAuthRouteFromStorage, toHref } from "../../lib/postAuthNavigation";

const TUTORIAL_SEEN_KEY = "prodify_tutorial_v1";

function readInitialLoginFields(): { email: string; password: string } {
  const preset = getE2eTestCredentials();
  return {
    email: preset?.email ?? "",
    password: preset?.password ?? "",
  };
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; source?: string; variant?: string }>();
  const initialFields = readInitialLoginFields();
  const [email, setEmail] = useState(initialFields.email);
  const [password, setPassword] = useState(initialFields.password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingPaywall = params.next === "paywall";
  const paywallVariant =
    params.variant === "outcome" || params.variant === "social_proof" ? params.variant : "value";

  async function onSubmit() {
    if (loading) return;
    const preset = getE2eTestCredentials();
    let trimmedEmail = email.trim();
    let passwordValue = password;
    if (!trimmedEmail && preset) {
      trimmedEmail = preset.email;
      passwordValue = preset.password;
    }
    if (!trimmedEmail) {
      setError(t("errors.validation.emailRequired"));
      return;
    }
    if (!passwordValue.trim()) {
      setError(t("errors.validation.passwordRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(trimmedEmail, passwordValue);
      if (isE2eModeEnabled()) {
        await AsyncStorage.multiSet([
          [ONBOARDING_COMPLETE_KEY, "1"],
          [WEEKLY_GOAL_CONFIGURED_KEY, "1"],
          [TUTORIAL_SEEN_KEY, "1"],
        ]).catch(() => undefined);
      }
      if (pendingPaywall) {
        router.replace({
          pathname: "/paywall",
          params: { source: "post_auth", variant: paywallVariant },
        });
        return;
      }
      const route = await resolvePostAuthRouteFromStorage({
        hasToken: true,
        entryPoint: "login",
      });
      if (route.pathname === "/(tabs)/dashboard") {
        await replaceWithPendingDeepLinkOrDashboard(router);
        return;
      }
      router.replace(toHref(route));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError(t("errors.tooManyRequests"));
      } else {
        const message = e instanceof Error ? e.message : t("auth.login.signInFailed");
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="login-screen"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <ProdifyWordmark />
          <Text style={styles.title}>{t("auth.login.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.login.subtitle")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t("auth.login.email")}</Text>
          <TextInput
            testID="email-input"
            style={styles.input}
            placeholder={t("auth.login.placeholderEmail")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel={t("auth.login.email")}
          />
          <Text style={styles.fieldLabel}>{t("auth.login.password")}</Text>
          <TextInput
            testID="password-input"
            style={styles.input}
            placeholder={t("auth.login.placeholderPassword")}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t("auth.login.password")}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label={t("auth.login.signIn")}
            onPress={onSubmit}
            loading={loading}
            testID="sign-in-button"
          />
        </View>

        <Pressable
          style={styles.linkWrap}
          accessibilityRole="button"
          accessibilityLabel={t("auth.login.noAccount")}
          onPress={() => {
            router.push({
              pathname: "/(auth)/register",
              params: pendingPaywall
                ? { next: "paywall", source: "onboarding", variant: paywallVariant }
                : undefined,
            });
          }}
        >
          <Text style={styles.link}>{t("auth.login.noAccount")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.background,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  title: {
    marginTop: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    letterSpacing: -0.8,
    textAlign: "center",
    ...typography.headline,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    textAlign: "center",
    ...typography.body,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontFamily: fontFamily.bodyMedium,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    fontFamily: fontFamily.body,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
    fontSize: 14,
  },
  linkWrap: {
    marginTop: 18,
    alignItems: "center",
  },
  link: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
  },
});
