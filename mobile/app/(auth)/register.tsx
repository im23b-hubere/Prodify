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

import { useAuth } from "../../context/AuthContext";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { ApiError } from "../../lib/client";
import { readOnboardingComplete } from "../../lib/postAuthNavigation";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (loading) return;
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    if (!trimmedEmail) {
      setError(t("errors.validation.emailRequired"));
      return;
    }
    if (!trimmedUsername) {
      setError(t("errors.validation.usernameRequired"));
      return;
    }
    if (trimmedUsername.length < 2) {
      setError(t("errors.validation.usernameShort"));
      return;
    }
    if (!password.trim()) {
      setError(t("errors.validation.passwordRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("errors.validation.passwordShort"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(trimmedEmail, trimmedUsername, password);
      const onboardingComplete = await readOnboardingComplete();
      router.replace(onboardingComplete ? "/(tabs)/dashboard" : "/onboarding");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError(t("errors.tooManyRequests"));
      } else {
        setError(e instanceof Error ? e.message : t("auth.register.registerFailed"));
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
          <Text style={styles.badge}>{t("brand")}</Text>
          <Text style={styles.title}>{t("auth.register.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.register.subtitle")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t("auth.register.email")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("auth.register.placeholderEmail")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel={t("auth.register.email")}
          />
          <Text style={styles.fieldLabel}>{t("auth.register.username")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("auth.register.placeholderUsername")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
            accessibilityLabel={t("auth.register.username")}
          />
          <Text style={styles.fieldLabel}>{t("auth.register.password")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("auth.register.placeholderPassword")}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t("auth.register.password")}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label={t("auth.register.createAccount")}
            onPress={onSubmit}
            loading={loading}
          />
        </View>

        <Link href="/(auth)/login" asChild>
          <Pressable
            style={styles.linkWrap}
            accessibilityRole="button"
            accessibilityLabel={t("auth.register.hasAccount")}
          >
            <Text style={styles.link}>{t("auth.register.hasAccount")}</Text>
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
    marginBottom: 18,
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.round,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: "700",
    overflow: "hidden",
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.background,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  title: {
    marginTop: 12,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    letterSpacing: -0.8,
    ...typography.headline,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 8,
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
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
