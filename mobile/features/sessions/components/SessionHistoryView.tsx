import { History } from "lucide-react-native";
import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { DashboardRecentSessionRow } from "../../../components/dashboard/DashboardRecentSessionRow";
import { EmptyState } from "../../../components/states/EmptyState";
import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import { formatSessionListDate } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";
import type { SessionHistoryController } from "../hooks/useSessionHistoryController";
import { styles } from "../sessionHistory.styles";
import { SessionHistoryHeader } from "./SessionHistoryHeader";

export function SessionHistoryView({ controller }: { controller: SessionHistoryController }) {
  const { t } = controller;
  const renderItem = useCallback(
    ({ item }: { item: SessionDto }) => {
      const typeLabel = sessionTypeLabel(String(item.session_type || "beat_making"), t);
      return (
        <Swipeable
          renderRightActions={() => (
            <DeleteAction
              label={t("dashboard.deleteSwipe")}
              onPress={() => void controller.dismissSession(item.id)}
            />
          )}
        >
          <DashboardRecentSessionRow
            session={item}
            typeLabel={typeLabel}
            accessibilityLabel={`${typeLabel}, ${formatSessionListDate(item.started_at)}`}
            accessibilityHint={t("dashboard.openSessionDetailsA11y")}
            onPress={() => controller.openSession(item.id)}
          />
        </Swipeable>
      );
    },
    [controller, t],
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={controller.sessions}
        keyExtractor={(item) => `history-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={controller.refresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={<SessionHistoryHeader controller={controller} />}
        ListEmptyComponent={
          !controller.loading && !controller.error ? (
            <EmptyState
              iconNode={<History color={colors.primary} size={40} />}
              title={t("sessionHistory.emptyTitle")}
              message={t("sessionHistory.emptyBody")}
              actionLabel={t("common.startSession")}
              onAction={controller.startSession}
            />
          ) : null
        }
        ListFooterComponent={<HistoryFooter controller={controller} />}
        onEndReached={() => {
          if (!controller.loading && !controller.loadingMore && controller.hasMore)
            void controller.loadMore();
        }}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

function DeleteAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.deleteAction} onPress={onPress}>
      <Text style={styles.deleteActionText}>{label}</Text>
    </Pressable>
  );
}

function HistoryFooter({ controller }: { controller: SessionHistoryController }) {
  if (!controller.hasMore || controller.sessions.length === 0)
    return <View style={styles.footerSpacer} />;
  return (
    <Pressable
      style={({ pressed }) => [styles.loadMoreBtn, pressed && { opacity: 0.88 }]}
      onPress={() => void controller.loadMore()}
      disabled={controller.loadingMore}
    >
      <Text style={styles.loadMoreText}>
        {controller.loadingMore
          ? controller.t("sessionHistory.loadingMore")
          : controller.t("sessionHistory.loadMore")}
      </Text>
    </Pressable>
  );
}
