import { Bell, Settings } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/states/EmptyState";
import { LoadingState } from "../../components/states/LoadingState";
import { BackButton } from "../../components/ui/BackButton";
import { colors } from "../../constants/theme";
import type { InboxItem } from "../../lib/notificationInbox";
import { NotificationFilterBar } from "./NotificationFilterBar";
import { NotificationInboxItem } from "./NotificationInboxItem";
import { NotificationPreferences } from "./NotificationPreferences";
import { notificationStyles as styles } from "./notification.styles";
import { notificationSections, type NotificationSectionKey } from "./notificationPresentation";
import type { NotificationInboxState } from "./useNotificationInbox";

type Props = {
  inbox: NotificationInboxState;
  onBack: () => void;
  onOpenAction: (route: string) => void;
};

const SECTION_LABEL_KEYS: Record<NotificationSectionKey, string> = {
  today: "notificationsUi.sectionToday",
  yesterday: "notificationsUi.sectionYesterday",
  earlier: "notificationsUi.sectionEarlier",
};

/**
 * Opening the inbox marks everything read straight away, so the ids that arrived unread are
 * kept here: their dot stays for as long as the screen is open.
 */
function useNewItemIds(items: InboxItem[]) {
  const seenUnread = useRef(new Set<string>());
  for (const item of items) {
    if (!item.read) seenUnread.current.add(item.id);
  }
  return seenUnread.current;
}

export function NotificationInboxView({ inbox, onBack, onOpenAction }: Props) {
  const { t } = useTranslation();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const newIds = useNewItemIds(inbox.items);
  const sections = useMemo(() => notificationSections(inbox.items), [inbox.items]);
  const renderItem = useCallback(
    ({ item }: { item: InboxItem }) => (
      <NotificationInboxItem
        item={item}
        isNew={newIds.has(item.id)}
        onOpenAction={onOpenAction}
        onRemove={inbox.remove}
      />
    ),
    [inbox.remove, newIds, onOpenAction],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        {inbox.settings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notificationsUi.settingsA11y")}
            hitSlop={6}
            onPress={() => setPrefsOpen(true)}
            style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
            testID="notifications-open-settings"
          >
            <Settings color={colors.textPrimary} size={22} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.screenTitle} accessibilityRole="header">
        {t("notificationsUi.title")}
      </Text>
      <NotificationFilterBar selected={inbox.filter} onSelect={inbox.setFilter} />
      <ServerSyncError error={inbox.token ? inbox.serverSyncError : null} onRetry={inbox.load} />
      {inbox.initialLoading && !inbox.refreshing ? (
        <View style={styles.loadingWrap}>
          <LoadingState message={t("notificationsUi.loading")} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={inbox.refreshing}
              onRefresh={inbox.refresh}
              tintColor={colors.primary}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader} accessibilityRole="header">
              {t(SECTION_LABEL_KEYS[section.key])}
            </Text>
          )}
          ItemSeparatorComponent={RowSeparator}
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
        <NotificationPreferences
          t={t}
          visible={prefsOpen}
          onClose={() => setPrefsOpen(false)}
          settings={inbox.settings}
          onUpdate={inbox.updateSetting}
        />
      ) : null}
    </SafeAreaView>
  );
}

function RowSeparator() {
  return <View style={styles.separator} />;
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
