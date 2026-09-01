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
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import {
  type RegisterFormController,
  useRegisterForm,
} from "../../features/auth/hooks/useRegisterForm";

function RegisterCard({ form }: { form: RegisterFormController }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>{t("auth.register.email")}</Text>
      <TextInput
        style={styles.input}
        placeholder={t("auth.register.placeholderEmail")}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={form.email}
        onChangeText={form.setEmail}
        accessibilityLabel={t("auth.register.email")}
      />
      <Text style={styles.fieldLabel}>{t("auth.register.username")}</Text>
      <TextInput
        style={styles.input}
        placeholder={t("auth.register.placeholderUsername")}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoComplete="username"
        value={form.username}
        onChangeText={form.setUsername}
        accessibilityLabel={t("auth.register.username")}
      />
      <Text style={styles.fieldLabel}>{t("auth.register.password")}</Text>
      <TextInput
        style={styles.input}
        placeholder={t("auth.register.placeholderPassword")}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        autoComplete="new-password"
        value={form.password}
        onChangeText={form.setPassword}
        accessibilityLabel={t("auth.register.password")}
      />

      {form.error ? (
        <Text
          testID="register-error"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.error}
        >
          {form.error}
        </Text>
      ) : null}
      {form.showConnectionHint ? (
        <Text accessibilityLiveRegion="polite" style={styles.connectionHint}>
          {t("auth.connectionHint")}
        </Text>
      ) : null}

      <PrimaryButton
        label={t("auth.register.createAccount")}
        onPress={form.submit}
        loading={form.loading}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const form = useRegisterForm(t);
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <ProdifyWordmark />
          <Text style={styles.title}>{t("auth.register.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.register.subtitle")}</Text>
        </View>
        <RegisterCard form={form} />

        <Pressable
          style={styles.linkWrap}
          accessibilityRole="button"
          accessibilityLabel={t("auth.register.hasAccount")}
          onPress={form.openLogin}
        >
          <Text style={styles.link}>{t("auth.register.hasAccount")}</Text>
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
    shadowRadius: 14,
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
  connectionHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: "center",
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
