import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { paywallStyles as styles } from "../paywall.styles";
import type { PaywallController } from "../usePaywallController";
import { PaywallFooter } from "./PaywallFooter";
import { PaywallPlans } from "./PaywallPlans";

type Props = {
  controller: PaywallController;
  signedIn: boolean;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
};

export function PaywallContent({ controller, signedIn, onOpenPrivacy, onOpenTerms }: Props) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(320)} style={styles.hero}>
          <Text style={styles.badge}>{t("paywall.badge")}</Text>
          <Text style={styles.title}>{controller.copy.title}</Text>
          <Text style={styles.body} numberOfLines={3}>
            {controller.copy.body}
          </Text>
        </Animated.View>

        <PaywallPlans controller={controller} />

        <View>
          <PaywallFooter
            signedIn={signedIn}
            busy={controller.busy}
            onOpenPrivacy={onOpenPrivacy}
            onOpenTerms={onOpenTerms}
            onLogout={controller.confirmLogout}
            onDeleteAccount={controller.confirmDeleteAccount}
          />
          {controller.expoGoPreviewMode ? (
            <Pressable
              style={styles.skipDev}
              onPress={() => void controller.onSkipSubscriptionForDev()}
              disabled={controller.busy}
              accessibilityRole="button"
              accessibilityLabel={t("paywall.a11y.skipSubscription")}
            >
              <Text style={styles.skipDevText}>
                {controller.busy
                  ? t("paywall.cta.pleaseWait")
                  : t("paywall.cta.skipSubscriptionDev")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
