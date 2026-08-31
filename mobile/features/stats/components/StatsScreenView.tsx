import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { colors } from "../../../constants/theme";
import type { StatsScreenController } from "../hooks/useStatsScreenController";
import { styles } from "../statsScreen.styles";
import { StatsScreenContent } from "./StatsScreenContent";
import { StatsScreenHeader } from "./StatsScreenHeader";
import { StatsSkeleton } from "./StatsSkeleton";

export function StatsScreenView({ controller }: { controller: StatsScreenController }) {
  const { t } = controller;
  const hasValidStats = controller.stats != null;
  // Initial failure: error + no stats → error/retry only (no fake 0h KPIs).
  // Refresh failure: keep last-known-good content under the existing error banner.
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
        {controller.showInitialLoading ? <StatsSkeleton /> : null}
        {controller.showInlineLoading ? <LoadingState message={t("stats.loading")} /> : null}
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
