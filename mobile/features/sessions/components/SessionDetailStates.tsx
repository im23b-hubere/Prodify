import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import type { SessionDetailController } from "../hooks/useSessionDetailController";
import { sessionDetailStyles as styles } from "../sessionDetail.styles";

export function SessionDetailLoading({ controller }: { controller: SessionDetailController }) {
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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
        <BackButton controller={controller} />
      </View>
    </SafeAreaView>
  );
}

export function BackButton({ controller }: { controller: SessionDetailController }) {
  return (
    <Pressable
      style={styles.backRow}
      accessibilityRole="button"
      accessibilityLabel={controller.t("sessionDetail.back")}
      onPress={controller.goBack}
    >
      <Text style={styles.backChevron}>‹</Text>
      <Text style={styles.backText}>{controller.t("sessionDetail.back")}</Text>
    </Pressable>
  );
}
