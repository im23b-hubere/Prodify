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
import { useLoginForm } from "../../features/auth/hooks/useLoginForm";
import { styles } from "../../features/auth/login.styles";

export default function LoginScreen() {
  const { t } = useTranslation();
  const form = useLoginForm(t);

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
            value={form.email}
            onChangeText={form.setEmail}
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
            value={form.password}
            onChangeText={form.setPassword}
            accessibilityLabel={t("auth.login.password")}
          />

          {form.error ? (
            <Text testID="login-error" accessibilityLiveRegion="polite" style={styles.error}>
              {form.error}
            </Text>
          ) : null}
          {form.showConnectionHint ? (
            <Text
              testID="login-connection-hint"
              accessibilityLiveRegion="polite"
              style={styles.connectionHint}
            >
              {t("auth.connectionHint")}
            </Text>
          ) : null}

          <PrimaryButton
            label={t("auth.login.signIn")}
            onPress={form.submit}
            loading={form.loading}
            testID="sign-in-button"
          />
        </View>

        <Pressable
          style={styles.linkWrap}
          accessibilityRole="button"
          accessibilityLabel={t("auth.login.noAccount")}
          onPress={form.openRegistration}
        >
          <Text style={styles.link}>{t("auth.login.noAccount")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
