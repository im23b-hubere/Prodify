import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { paywallStyles as styles } from "../paywall.styles";

type Props = {
  signedIn: boolean;
  busy: boolean;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
};

export function PaywallFooter(props: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.footer}>
      <Text style={styles.disclaimer}>{t("paywall.legal.disclaimer")}</Text>
      <View style={styles.legalRow}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("paywall.legal.privacyLink")}
          onPress={props.onOpenPrivacy}
        >
          <Text style={styles.legalLink}>{t("paywall.legal.privacyLink")}</Text>
        </Pressable>
        <Text style={styles.legalSep}>·</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("paywall.legal.termsLink")}
          onPress={props.onOpenTerms}
        >
          <Text style={styles.legalLink}>{t("paywall.legal.termsLink")}</Text>
        </Pressable>
      </View>
      {props.signedIn ? <PaywallAccountActions {...props} /> : null}
    </View>
  );
}

function PaywallAccountActions({ busy, onLogout, onDeleteAccount }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.legalRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("paywall.account.signOut")}
        onPress={onLogout}
        disabled={busy}
      >
        <Text style={styles.accountActionText}>{t("paywall.account.signOut")}</Text>
      </Pressable>
      <Text style={styles.legalSep}>·</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("paywall.account.deleteAccount")}
        onPress={onDeleteAccount}
        disabled={busy}
      >
        <Text style={styles.accountActionText}>{t("paywall.account.deleteAccount")}</Text>
      </Pressable>
    </View>
  );
}
