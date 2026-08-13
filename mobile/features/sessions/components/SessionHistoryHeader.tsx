import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { colors } from "../../../constants/theme";
import type { SessionHistoryController } from "../hooks/useSessionHistoryController";
import { styles } from "../sessionHistory.styles";

export function SessionHistoryHeader({ controller }: { controller: SessionHistoryController }) {
  const { t } = controller;
  return (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("sessionHistory.backA11y")}
          onPress={controller.goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.88 }]}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t("sessionHistory.title")}</Text>
          <Text style={styles.subtitle}>{controller.subtitle}</Text>
        </View>
      </View>
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
