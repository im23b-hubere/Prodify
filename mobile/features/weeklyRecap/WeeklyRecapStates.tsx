import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { colors } from "../../constants/theme";
import type { WeeklyRecapController } from "./useWeeklyRecapController";
import { weeklyRecapStyles as styles } from "./weeklyRecap.styles";

export function WeeklyRecapLoading() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </SafeAreaView>
  );
}

export function WeeklyRecapSignIn({ controller }: { controller: WeeklyRecapController }) {
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.stateWrap}>
        <EmptyState
          title={t("weeklyRecap.needSignInTitle")}
          message={t("weeklyRecap.needSignInBody")}
          actionLabel={t("weeklyRecap.signInCta")}
          onAction={controller.signIn}
        />
        <PrimaryButton label={t("weeklyRecap.close")} onPress={controller.close} />
      </View>
    </SafeAreaView>
  );
}

export function WeeklyRecapError({ controller }: { controller: WeeklyRecapController }) {
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.stateWrap}>
        <ErrorState
          title={t("common.oops")}
          message={controller.error ?? ""}
          retryLabel={t("common.tryAgain")}
          onRetry={() => void controller.load()}
        />
        <PrimaryButton label={t("weeklyRecap.close")} onPress={controller.close} />
      </View>
    </SafeAreaView>
  );
}
