import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import type { ActiveSessionController } from "../hooks/useActiveSessionController";
import { sessionActiveStyles as styles } from "../sessionActive.styles";

export function ActiveSessionBoot({ controller }: { controller: ActiveSessionController }) {
  const { t } = useTranslation();
  const loadingMessage = controller.id
    ? t("sessionActive.resumingSession")
    : t("sessionActive.loadingSession");
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.bootWrap}>
        {controller.loading && !controller.error ? (
          <LoadingState message={loadingMessage} />
        ) : (
          <>
            <ErrorState
              title={t("common.oops")}
              message={controller.error ?? t("sessionActive.loadFailed")}
              retryLabel={t("common.tryAgain")}
              onRetry={() => void controller.load()}
            />
            <Pressable
              onPress={controller.openDashboard}
              style={styles.bootBackBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <Text style={styles.bootBackTxt}>{t("common.back")}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
