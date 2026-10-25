import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { paywallStyles as styles } from "../paywall.styles";

type Props = {
  /** Price, period and how to cancel for the selected plan. */
  renewalNote: string;
  busy: boolean;
  restoreDisabled: boolean;
  onRestore: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  /** Signed in only: a quiet way out for anyone who decides not to subscribe. */
  onDeleteAccount?: () => void;
};

/** The renewal note, then restore and the legal links the App Store asks for. */
export function PaywallFooter({
  renewalNote,
  busy,
  restoreDisabled,
  onRestore,
  onOpenPrivacy,
  onOpenTerms,
  onDeleteAccount,
}: Props) {
  const { t } = useTranslation();
  const links = [
    {
      label: busy ? t("paywall.cta.pleaseWait") : t("paywall.cta.restore"),
      a11yLabel: t("paywall.cta.restore"),
      role: "button" as const,
      onPress: onRestore,
      disabled: restoreDisabled,
    },
    {
      label: t("paywall.legal.termsLink"),
      a11yLabel: t("paywall.legal.termsLink"),
      role: "link" as const,
      onPress: onOpenTerms,
      disabled: false,
    },
    {
      label: t("paywall.legal.privacyLink"),
      a11yLabel: t("paywall.legal.privacyLink"),
      role: "link" as const,
      onPress: onOpenPrivacy,
      disabled: false,
    },
  ];

  return (
    <View>
      <Text style={styles.disclaimer}>{renewalNote}</Text>
      <View style={styles.links}>
        {links.map((link, index) => (
          <Fragment key={link.a11yLabel}>
            {index > 0 ? <Text style={styles.linkDot}>·</Text> : null}
            <Pressable
              accessibilityRole={link.role}
              accessibilityLabel={link.a11yLabel}
              onPress={link.onPress}
              disabled={link.disabled}
              style={styles.link}
            >
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          </Fragment>
        ))}
      </View>
      {onDeleteAccount ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("legal.deleteAccount.button")}
          onPress={onDeleteAccount}
          disabled={busy}
          style={styles.deleteAccount}
        >
          <Text style={styles.deleteAccountText}>{t("legal.deleteAccount.button")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
