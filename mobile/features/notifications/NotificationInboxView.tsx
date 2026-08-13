import { Bell } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/states/EmptyState";
import { LoadingState } from "../../components/states/LoadingState";
import { colors } from "../../constants/theme";
import type { InboxItem } from "../../lib/notificationInbox";
import { NotificationFilterBar } from "./NotificationFilterBar";
import { NotificationInboxItem } from "./NotificationInboxItem";
import { NotificationPreferences } from "./NotificationPreferences";
import { notificationStyles as styles } from "./notification.styles";
import type { NotificationInboxState } from "./useNotificationInbox";

type Props = {
  inbox: NotificationInboxState;
  onBack: () => void;
  onOpenAction: (route: string) => void;
};

export function NotificationInboxView({ inbox, onBack, onOpenAction }: Props) {
  const { t } = useTranslation();
  const renderItem = useCallback(
    ({ item }: { item: InboxItem }) => (
      <NotificationInboxItem item={item} onOpenAction={onOpenAction} onRemove={inbox.remove} />
    ),
    [inbox.remove, onOpenAction],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{t("notificationsUi.back")}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {t("notificationsUi.title")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <NotificationFilterBar selected={inbox.filter} onSelect={inbox.setFilter} />
      <ServerSyncError error={inbox.token ? inbox.serverSyncError : null} onRetry={inbox.load} />
      {inbox.initialLoading && !inbox.refreshing ? (
        <View style={styles.loadingWrap}>
          <LoadingState message={t("notificationsUi.loading")} />
        </View>
      ) : (
        <FlatList
          data={inbox.items}
          keyExtractor={(item) => item.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={inbox.refreshing}
              onRefresh={inbox.refresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              iconNode={<Bell color={colors.primary} size={40} />}
              title={t("notificationsUi.emptyTitle")}
              message={t("notificationsUi.emptySub")}
            />
          }
          renderItem={renderItem}
        />
      )}
      {inbox.settings ? (
        <NotificationPreferences t={t} settings={inbox.settings} onUpdate={inbox.updateSetting} />
      ) : null}
    </SafeAreaView>
  );
}

function ServerSyncError({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => Promise<void>;
}) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <View style={styles.serverErrorBanner}>
      <Text style={styles.serverErrorText}>{error}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.tryAgain")}
        style={styles.serverErrorRetry}
        onPress={() => void onRetry()}
      >
        <Text style={styles.serverErrorRetryText}>{t("common.tryAgain")}</Text>
      </Pressable>
    </View>
  );
}
