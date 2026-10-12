import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { pressFeedbackStyle } from "../../../components/ui/pressFeedback";
import { fontFamily } from "../../../constants/fonts";
import { colors, motion, radii, spacing, typography } from "../../../constants/theme";
import type { SocialSignInController } from "../hooks/useSocialSignIn";

/** Secondary to the email CTA (56 pt), but above Apple's 44 pt minimum touch target. */
const SOCIAL_BUTTON_HEIGHT = 44;
const SOCIAL_BUTTON_RADIUS = radii.sm;
const SOCIAL_BUTTON_BORDER_WIDTH = 1;
/** Apple's black style and Google's dark theme share a black fill; the outline lifts it off the near-black screen. */
const SOCIAL_BUTTON_FILL = "#000000";
const SOCIAL_BUTTON_BORDER = "#2a2a2a";

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
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={SOCIAL_BUTTON_RADIUS - SOCIAL_BUTTON_BORDER_WIDTH}
            style={styles.appleButton}
            onPress={controller.continueWithApple}
          />
          {controller.pendingProvider === "apple" ? (
            <View style={styles.appleSpinner} pointerEvents="none">
              <ActivityIndicator color={colors.textPrimary} />
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
            <ActivityIndicator color={colors.textPrimary} />
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
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
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
  root: { marginTop: spacing.lg, gap: spacing.sm + 2 },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, marginBottom: spacing.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.textSecondary, opacity: 0.3 },
  dividerLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  appleWrap: {
    height: SOCIAL_BUTTON_HEIGHT,
    borderRadius: SOCIAL_BUTTON_RADIUS,
    borderCurve: "continuous",
    borderWidth: SOCIAL_BUTTON_BORDER_WIDTH,
    borderColor: SOCIAL_BUTTON_BORDER,
    backgroundColor: SOCIAL_BUTTON_FILL,
    overflow: "hidden",
  },
  appleButton: { width: "100%", height: "100%" },
  appleSpinner: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SOCIAL_BUTTON_FILL,
  },
  googleButton: {
    height: SOCIAL_BUTTON_HEIGHT,
    borderRadius: SOCIAL_BUTTON_RADIUS,
    borderCurve: "continuous",
    borderWidth: SOCIAL_BUTTON_BORDER_WIDTH,
    borderColor: SOCIAL_BUTTON_BORDER,
    backgroundColor: SOCIAL_BUTTON_FILL,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  googleLabel: {
    color: colors.textPrimary,
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
