import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { pressFeedbackStyle } from "../../../components/ui/pressFeedback";
import { fontFamily } from "../../../constants/fonts";
import { colors, motion, spacing, typography, ui } from "../../../constants/theme";
import type { SocialSignInController } from "../hooks/useSocialSignIn";

type SocialSignInButtonsProps = {
  controller: SocialSignInController;
  /** True while the email form is submitting, so only one sign-in runs at a time. */
  disabled?: boolean;
};

export function SocialSignInButtons({ controller, disabled = false }: SocialSignInButtonsProps) {
  const { t } = useTranslation();
  if (!controller.hasAnyProvider) return null;

  const isBusy = disabled || controller.pendingProvider !== null;

  return (
    <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.root}>
      <View style={styles.divider} accessible={false}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>{t("auth.social.divider")}</Text>
        <View style={styles.dividerLine} />
      </View>

      {controller.isAppleAvailable ? (
        <View
          style={[styles.appleWrap, isBusy && styles.disabled]}
          pointerEvents={isBusy ? "none" : "auto"}
          accessibilityState={{ disabled: isBusy, busy: controller.pendingProvider === "apple" }}
        >
          <AppleAuthentication.AppleAuthenticationButton
            testID="apple-sign-in-button"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={ui.cardRadius}
            style={styles.appleButton}
            onPress={controller.continueWithApple}
          />
          {controller.pendingProvider === "apple" ? (
            <View style={styles.appleSpinner} pointerEvents="none">
              <ActivityIndicator color={colors.background} />
            </View>
          ) : null}
        </View>
      ) : null}

      {controller.isGoogleAvailable ? (
        <Pressable
          testID="google-sign-in-button"
          accessibilityRole="button"
          accessibilityLabel={t("auth.social.continueWithGoogle")}
          accessibilityState={{ disabled: isBusy, busy: controller.pendingProvider === "google" }}
          disabled={isBusy}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            void controller.continueWithGoogle();
          }}
          style={({ pressed }) => [
            styles.googleButton,
            pressFeedbackStyle(pressed),
            isBusy && styles.disabled,
          ]}
        >
          {controller.pendingProvider === "google" ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <GoogleLogo />
              <Text style={styles.googleLabel}>{t("auth.social.continueWithGoogle")}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {controller.error ? (
        <Text
          testID="social-sign-in-error"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.error}
        >
          {controller.error}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** Official multi-color "G" mark (Google Sign-In branding guidelines). */
function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.lg, gap: spacing.sm + 4 },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.textSecondary, opacity: 0.4 },
  dividerLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    ...typography.meta,
  },
  appleWrap: { height: ui.buttonHeight },
  appleButton: { width: "100%", height: ui.buttonHeight },
  appleSpinner: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ui.cardRadius,
    borderCurve: "continuous",
    backgroundColor: colors.textPrimary,
  },
  googleButton: {
    height: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    borderCurve: "continuous",
    backgroundColor: colors.textPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  googleLabel: {
    color: colors.background,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
  disabled: { opacity: 0.5 },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.body,
    textAlign: "center",
    ...typography.bodySmall,
  },
});
