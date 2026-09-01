import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { colors } from "../../../constants/theme";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";
import { StatsScreenContent } from "./StatsScreenContent";
import { StatsScreenHeader } from "./StatsScreenHeader";
import { StatsScanLine } from "./StatsSkeleton";

export function StatsScreenView({ controller }: { controller: StatsScreenController }) {
  const { t } = controller;
  const hasValidStats = controller.stats != null;
  const showStatsContent =
    !controller.showInitialLoading && (hasValidStats || !controller.error);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="stats-screen">
      <ScrollView
        ref={controller.scrollRef}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.refresh}
            tintColor={colors.primary}
          />
        }
      >
        <StatsScreenHeader controller={controller} />
        {controller.showScanLine ? <StatsScanLine /> : null}
        {!controller.loading && controller.error ? (
          <ErrorState
            title={t("common.oops")}
            message={controller.error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => void controller.loadStats({ force: true, forceProgressionSync: true })}
          />
        ) : null}
        {showStatsContent ? <StatsScreenContent controller={controller} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
