import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { paywallStyles as styles } from "../paywall.styles";

/** The signed-in account and the ways out for anyone who decides not to subscribe here. */
export type PaywallAccount = {
  name: string | null;
  onSwitch: () => void;
  onDelete: () => void;
};

type Props = {
  /** Price, period and how to cancel for the selected plan. */
  renewalNote: string;
  busy: boolean;
  restoreDisabled: boolean;
  onRestore: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  /** Signed in only. */
  account?: PaywallAccount;
};

/** The renewal note, restore and the legal links the App Store asks for, then the account. */
export function PaywallFooter({
  renewalNote,
  busy,
  restoreDisabled,
  onRestore,
  onOpenPrivacy,
  onOpenTerms,
  account,
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
      {account ? <PaywallAccountActions account={account} busy={busy} /> : null}
    </View>
  );
}

/** Someone signed in with the wrong account must be able to switch without deleting it. */
function PaywallAccountActions({ account, busy }: { account: PaywallAccount; busy: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.links}>
        {account.name ? (
          <>
            <Text style={styles.accountText}>
              {t("paywall.account.signedInAs", { name: account.name })}
            </Text>
            <Text style={styles.linkDot}>·</Text>
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("paywall.account.switch")}
          onPress={account.onSwitch}
          disabled={busy}
          style={styles.link}
        >
          <Text style={styles.switchAccountText}>{t("paywall.account.switch")}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("legal.deleteAccount.button")}
        onPress={account.onDelete}
        disabled={busy}
        style={styles.deleteAccount}
      >
        <Text style={styles.deleteAccountText}>{t("legal.deleteAccount.button")}</Text>
      </Pressable>
    </>
  );
}
