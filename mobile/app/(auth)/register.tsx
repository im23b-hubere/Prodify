import { Link, useRouter } from "expo-router";
import { useState } from "react";
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

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), username.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
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
          <Text style={styles.badge}>New account</Text>
          <Text style={styles.title}>Let's get started</Text>
          <Text style={styles.subtitle}>Set up your profile and start your first streak.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#737373"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#737373"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
          />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor="#737373"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label="Create account" onPress={onSubmit} loading={loading} />
        </View>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
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
    backgroundColor: "#1f1f1f",
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
