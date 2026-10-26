import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ProdifyWordmark } from "../../components/brand/ProdifyWordmark";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { colors } from "../../constants/theme";
import { usePasswordResetForm } from "../../features/auth/hooks/usePasswordResetForm";
import { styles } from "../../features/auth/login.styles";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const form = usePasswordResetForm(t);
  const enteringCode = form.step === "code";

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="forgot-password-screen"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <ProdifyWordmark />
          <Text style={styles.title} accessibilityRole="header">
            {t("auth.reset.title")}
          </Text>
          <Text style={styles.subtitle}>
            {enteringCode
              ? t("auth.reset.codeSent", { email: form.email })
              : t("auth.reset.subtitle")}
          </Text>
        </View>

        <View style={styles.card}>
          {enteringCode ? (
            <>
              <Text style={styles.fieldLabel}>{t("auth.reset.code")}</Text>
              <TextInput
                testID="reset-code-input"
                style={styles.input}
                placeholder={t("auth.reset.placeholderCode")}
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                value={form.code}
                onChangeText={form.setCode}
                accessibilityLabel={t("auth.reset.code")}
              />
              <Text style={styles.fieldLabel}>{t("auth.reset.newPassword")}</Text>
              <TextInput
                testID="reset-password-input"
                style={styles.input}
                placeholder={t("auth.reset.placeholderNewPassword")}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                value={form.newPassword}
                onChangeText={form.setNewPassword}
                accessibilityLabel={t("auth.reset.newPassword")}
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>{t("auth.login.email")}</Text>
              <TextInput
                testID="reset-email-input"
                style={styles.input}
                placeholder={t("auth.login.placeholderEmail")}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={form.email}
                onChangeText={form.setEmail}
                accessibilityLabel={t("auth.login.email")}
              />
            </>
          )}

          {form.error ? (
            <Text testID="reset-error" accessibilityLiveRegion="polite" style={styles.error}>
              {form.error}
            </Text>
          ) : null}

          <PrimaryButton
            label={enteringCode ? t("auth.reset.submit") : t("auth.reset.sendCode")}
            onPress={enteringCode ? form.submit : form.sendCode}
            loading={form.loading}
            testID={enteringCode ? "reset-submit-button" : "reset-send-code-button"}
          />

          {enteringCode ? (
            <View style={styles.secondaryActions}>
              <Pressable
                accessibilityRole="button"
                onPress={form.changeEmail}
                disabled={form.loading}
                hitSlop={8}
              >
                <Text style={styles.link}>{t("auth.reset.changeEmail")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={form.sendCode}
                disabled={form.loading}
                hitSlop={8}
                testID="reset-resend-button"
              >
                <Text style={styles.link}>{t("auth.reset.resend")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.linkWrap} accessibilityRole="button" onPress={form.backToLogin}>
          <Text style={styles.link}>{t("auth.reset.backToLogin")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
