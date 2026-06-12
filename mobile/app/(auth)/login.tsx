import { Link, useRouter } from "expo-router";
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
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { ApiError } from "../../lib/client";
import { replaceWithPendingDeepLinkOrDashboard } from "../../lib/pendingDeepLink";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (loading) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t("errors.validation.emailRequired"));
      return;
    }
    if (!password.trim()) {
      setError(t("errors.validation.passwordRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
      await replaceWithPendingDeepLinkOrDashboard(router);
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

          <PrimaryButton label={t("auth.login.signIn")} onPress={onSubmit} loading={loading} />
        </View>

        <Link href="/(auth)/register" asChild>
          <Pressable
            style={styles.linkWrap}
            accessibilityRole="button"
            accessibilityLabel={t("auth.login.noAccount")}
          >
            <Text style={styles.link}>{t("auth.login.noAccount")}</Text>
          </Pressable>
        </Link>
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
