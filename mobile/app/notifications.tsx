import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Bell, Flame, Lightbulb, Trophy, Users } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { debugNav } from "../lib/debugLog";
import { deepLinkRequiresAuth, isAllowedDeepLinkPath, toRoutableHref } from "../lib/deepLinkGuard";
import { colors } from "../constants/theme";
import { notificationStyles as styles } from "../features/notifications/notification.styles";
import { useNotificationInbox } from "../features/notifications/useNotificationInbox";
import { NotificationPreferences } from "../features/notifications/NotificationPreferences";
import {
  formatNotificationRelativeTime,
  NOTIFICATION_FILTER_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  safeNotificationCategory,
} from "../features/notifications/notificationPresentation";
import { type InboxItem, type NotificationCategory } from "../lib/notificationInbox";

const CAT_META: Record<NotificationCategory, { icon: typeof Flame }> = {
  streak: { icon: Flame },
  achievement: { icon: Trophy },
  social: { icon: Users },
  tips: { icon: Lightbulb },
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const {
    token,
    items,
    settings,
    initialLoading,
    refreshing,
    filter,
    setFilter,
    serverSyncError,
    load,
    refresh,
    updateSetting,
    remove,
  } = useNotificationInbox();

  const pushInboxActionRoute = useCallback(
    (rawPath: string) => {
      if (!isAllowedDeepLinkPath(rawPath)) {
        debugNav("inbox_action_route_blocked", { path: rawPath });
        return;
      }
      if (deepLinkRequiresAuth(rawPath) && !token) {
        router.replace("/(auth)/login");
        return;
      }
      router.push(toRoutableHref(rawPath) as Href);
    },
    [router, token],
  );

  const renderRight = useCallback(
    (id: string) => (
      <Pressable
        style={styles.deleteBtn}
        onPress={() => {
          remove(id).catch(() => undefined);
        }}
      >
        <Text style={styles.deleteTxt}>{t("notificationsUi.delete")}</Text>
      </Pressable>
    ),
    [remove, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: InboxItem }) => {
      const cat = safeNotificationCategory(item.category);
      const meta = CAT_META[cat];
      const Icon = meta.icon;
      return (
        <Swipeable renderRightActions={() => renderRight(item.id)}>
          <View style={[styles.card, !item.read && styles.cardUnread]}>
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={styles.priorityChip}>
                    <Text style={styles.priorityChipText}>
                      {t(NOTIFICATION_PRIORITY_LABELS[item.priority])}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardMsg}>{item.body}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.time}>
                    {formatNotificationRelativeTime(item.createdAt, t)}
                  </Text>
                  {item.actionLabel && item.actionRoute ? (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                          () => undefined,
                        );
                        const actionRoute = item.actionRoute;
                        if (!actionRoute) return;
                        try {
                          pushInboxActionRoute(actionRoute);
                        } catch (e) {
                          debugNav("inbox_action_push_failed", {
                            message: e instanceof Error ? e.message : "unknown",
                          });
                        }
                      }}
                    >
                      <Text style={styles.action}>{item.actionLabel} →</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </Swipeable>
      );
    },
    [pushInboxActionRoute, renderRight, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace(params.source === "profile" ? "/(tabs)/profile" : "/(tabs)/dashboard");
          }}
          hitSlop={12}
        >
          <Text style={styles.back}>{t("notificationsUi.back")}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {t("notificationsUi.title")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterRow}>
        {(["all", "streak", "achievement", "social", "tips"] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              setFilter(k);
            }}
            style={[styles.filterChip, filter === k && styles.filterChipOn]}
          >
            <Text style={[styles.filterTxt, filter === k && styles.filterTxtOn]}>
              {t(NOTIFICATION_FILTER_LABELS[k])}
            </Text>
          </Pressable>
        ))}
      </View>

      {token && serverSyncError ? (
        <View style={styles.serverErrorBanner}>
          <Text style={styles.serverErrorText}>{serverSyncError}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.tryAgain")}
            style={styles.serverErrorRetry}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              void load();
            }}
          >
            <Text style={styles.serverErrorRetryText}>{t("common.tryAgain")}</Text>
          </Pressable>
        </View>
      ) : null}

      {initialLoading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <LoadingState message={t("notificationsUi.loading")} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
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

      {settings ? (
        <NotificationPreferences t={t} settings={settings} onUpdate={updateSetting} />
      ) : null}
    </SafeAreaView>
  );
}
