import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Bell, Flame, Lightbulb, Trophy, Users } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { useAuth } from "../context/AuthContext";
import { debugNav } from "../lib/debugLog";
import { deepLinkRequiresAuth, isAllowedDeepLinkPath, toRoutableHref } from "../lib/deepLinkGuard";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography } from "../constants/theme";
import {
  loadInbox,
  loadSettings,
  markAllRead,
  markServerInboxRead,
  removeItem,
  saveSettings,
  syncServerInbox,
  type InboxItem,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationSettings,
} from "../lib/notificationInbox";
import { syncWeeklyRecapReminder } from "../lib/weeklyRecapNotifications";

const CAT_META: Record<NotificationCategory, { icon: typeof Flame }> = {
  streak: { icon: Flame },
  achievement: { icon: Trophy },
  social: { icon: Users },
  tips: { icon: Lightbulb },
};

const FILTER_LABEL_KEY: Record<NotificationCategory | "all", string> = {
  all: "notificationsUi.filterAll",
  streak: "notificationsUi.catStreak",
  achievement: "notificationsUi.catAchievement",
  social: "notificationsUi.catSocial",
  tips: "notificationsUi.catTips",
};

const PRIORITY_LABEL_KEY: Record<NotificationPriority, string> = {
  low: "notificationsUi.priorityLow",
  normal: "notificationsUi.priorityNormal",
  high: "notificationsUi.priorityHigh",
  critical: "notificationsUi.priorityCritical",
};

function formatRelativeTime(ts: number, tr: TFunction) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return tr("notificationsUi.timeNow");
  if (m < 60) return tr("notificationsUi.timeMin", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return tr("notificationsUi.timeHour", { h });
  return tr("notificationsUi.timeDay", { d: Math.floor(h / 24) });
}

function safeCategory(cat: string): NotificationCategory {
  if (cat === "streak" || cat === "achievement" || cat === "social" || cat === "tips") {
    return cat;
  }
  return "tips";
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    const serverErrors: string[] = [];
    if (token) {
      try {
        await syncServerInbox(token, 60);
      } catch (e) {
        serverErrors.push(e instanceof Error ? e.message : t("notificationsUi.syncFailed"));
      }
    }
    const [inbox, s] = await Promise.all([loadInbox(), loadSettings()]);
    setItems(inbox);
    setSettings(s);
    await markAllRead();
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    if (token) {
      const maxVisibleCreatedAt = inbox.reduce(
        (max, item) => (item.createdAt > max ? item.createdAt : max),
        0,
      );
      try {
        await markServerInboxRead(token, maxVisibleCreatedAt || Date.now());
      } catch (e) {
        serverErrors.push(e instanceof Error ? e.message : t("notificationsUi.readSyncFailed"));
      }
    }
    setServerSyncError(serverErrors.length > 0 ? serverErrors.join("\n") : null);
    setInitialLoading(false);
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await load().catch(() => undefined);
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => safeCategory(i.category) === filter);
  }, [items, filter]);

  const updateSetting = async (patch: Partial<NotificationSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    if ("tips" in patch || "frequency" in patch) {
      void syncWeeklyRecapReminder(Boolean(token) && next.tips && next.frequency !== "off");
    }
    Haptics.selectionAsync().catch(() => undefined);
  };

  const renderRight = useCallback(
    (id: string) => (
      <Pressable
        style={styles.deleteBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          removeItem(id)
            .then(() => load())
            .catch(() => undefined);
        }}
      >
        <Text style={styles.deleteTxt}>{t("notificationsUi.delete")}</Text>
      </Pressable>
    ),
    [load, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: InboxItem }) => {
      const cat = safeCategory(item.category);
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
                      {t(PRIORITY_LABEL_KEY[item.priority])}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardMsg}>{item.body}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.time}>{formatRelativeTime(item.createdAt, t)}</Text>
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
              {t(FILTER_LABEL_KEY[k])}
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
          data={filtered}
          keyExtractor={(i) => i.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
        <View style={styles.settings}>
          <Text style={styles.settingsTitle}>{t("notificationsUi.preferences")}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.streakReminders")}</Text>
            <Switch
              value={settings.streak}
              onValueChange={(v) =>
                void updateSetting({
                  streak: v,
                  ...(v && settings.frequency === "off" ? { frequency: "all" as const } : {}),
                })
              }
              trackColor={{ false: "#333", true: "rgba(255,61,0,0.45)" }}
              thumbColor="#fafafa"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.achievements")}</Text>
            <Switch
              value={settings.achievements}
              onValueChange={(v) =>
                void updateSetting({
                  achievements: v,
                  ...(v && settings.frequency === "off" ? { frequency: "all" as const } : {}),
                })
              }
              trackColor={{ false: "#333", true: "rgba(162,89,255,0.45)" }}
              thumbColor="#fafafa"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.socialUpdates")}</Text>
            <Switch
              value={settings.social}
              onValueChange={(v) =>
                void updateSetting({
                  social: v,
                  ...(v && settings.frequency === "off" ? { frequency: "all" as const } : {}),
                })
              }
              trackColor={{ false: "#333", true: "rgba(59,130,246,0.45)" }}
              thumbColor="#fafafa"
            />
          </View>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowLabel}>{t("notificationsUi.tipsAndNudges")}</Text>
              <Text style={styles.rowHint}>{t("notificationsUi.tipsAndNudgesHint")}</Text>
            </View>
            <Switch
              value={settings.tips}
              onValueChange={(v) =>
                void updateSetting({
                  tips: v,
                  ...(v && settings.frequency === "off" ? { frequency: "all" as const } : {}),
                })
              }
              trackColor={{ false: "#333", true: "rgba(234,179,8,0.45)" }}
              thumbColor="#fafafa"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.quietHours")}</Text>
            <Switch
              value={settings.quietStartHour === 23 && settings.quietEndHour === 7}
              onValueChange={(v) =>
                updateSetting(
                  v
                    ? { quietStartHour: 23, quietEndHour: 7 }
                    : { quietStartHour: 0, quietEndHour: 0 },
                )
              }
              trackColor={{ false: "#333", true: "rgba(255,255,255,0.2)" }}
              thumbColor="#fafafa"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.deliveryMode")}</Text>
            <Pressable
              style={styles.modeChip}
              onPress={() =>
                updateSetting({
                  frequency:
                    settings.frequency === "all"
                      ? "important"
                      : settings.frequency === "important"
                        ? "off"
                        : "all",
                })
              }
            >
              <Text style={styles.modeChipText}>
                {settings.frequency === "all"
                  ? t("notificationsUi.modeAll")
                  : settings.frequency === "important"
                    ? t("notificationsUi.modeImportant")
                    : t("notificationsUi.modeOff")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  back: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.body },
  title: {
    flex: 1,
    marginHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
    textAlign: "center",
  },
  headerSpacer: { width: 56 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipOn: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  filterTxt: {
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  filterTxtOn: { color: colors.textPrimary },
  serverErrorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.1)",
    gap: spacing.xs,
  },
  serverErrorText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  serverErrorRetry: { alignSelf: "flex-start" },
  serverErrorRetryText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  listFlex: { flex: 1 },
  loadingWrap: { flex: 1, paddingHorizontal: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderColor: "rgba(255,61,0,0.45)" },
  cardTop: { flexDirection: "row", gap: spacing.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  priorityChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  priorityChipText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontSize: 11,
    fontFamily: fontFamily.bodyBold,
  },
  cardMsg: { color: colors.textSecondary, ...typography.caption },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  time: { color: colors.textSecondary, ...typography.caption, fontSize: 12 },
  action: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  deleteBtn: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  deleteTxt: { color: "#fff", fontFamily: fontFamily.bodyBold },
  settings: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  settingsTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowCopy: { flex: 1, paddingRight: spacing.sm, gap: 2 },
  rowLabel: { color: colors.textPrimary, ...typography.body },
  rowHint: { color: colors.textSecondary, ...typography.caption },
  modeChip: {
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  modeChipText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontFamily: fontFamily.bodyBold,
  },
});
