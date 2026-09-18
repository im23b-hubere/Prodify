import { Pressable, Text, View } from "react-native";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { ScreenTopBar } from "../../../components/ui/ScreenTopBar";
import type { SessionHistoryController } from "../hooks/useSessionHistoryController";
import { styles } from "../sessionHistory.styles";

export function SessionHistoryHeader({ controller }: { controller: SessionHistoryController }) {
  const { t } = controller;
  return (
    <View style={styles.headerBlock}>
      <ScreenTopBar
        title={t("sessionHistory.title")}
        subtitle={controller.subtitle}
        onBack={controller.goBack}
      />
      <View style={styles.headerLinks}>
        <Pressable
          onPress={controller.openTrash}
          style={({ pressed }) => pressed && styles.linkPressed}
        >
          <Text style={styles.link}>{t("sessionHistory.viewTrash")}</Text>
        </Pressable>
      </View>
      {controller.loading && !controller.refreshing ? (
        <LoadingState message={t("sessionHistory.loading")} />
      ) : null}
      {controller.error ? (
        <ErrorState
          title={t("common.oops")}
          message={controller.error}
          retryLabel={t("common.tryAgain")}
          onRetry={controller.retry}
        />
      ) : null}
    </View>
  );
}
