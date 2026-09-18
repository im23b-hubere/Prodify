import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { BackButton } from "../../../components/ui/BackButton";
import type { SessionDetailController } from "../hooks/useSessionDetailController";
import { sessionDetailStyles as styles } from "../sessionDetail.styles";

export function SessionDetailLoading({ controller }: { controller: SessionDetailController }) {
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <BackButton onPress={controller.goBack} style={styles.loadingBack} />
      <View style={styles.loadingWrap}>
        {controller.error ? (
          <ErrorState
            title={t("common.oops")}
            message={controller.error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => void controller.load()}
          />
        ) : (
          <LoadingState message={t("sessionDetail.loading")} />
        )}
      </View>
    </SafeAreaView>
  );
}
