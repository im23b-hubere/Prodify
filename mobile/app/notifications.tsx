import { type Href, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Bell, Flame, Lightbulb, Trophy, Users } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../constants/fonts";
import { debugNav } from "../lib/debugLog";
import { colors, radii, spacing, typography } from "../constants/theme";
import {
  loadInbox,
  loadSettings,
  markAllRead,
  removeItem,
  saveSettings,
  type InboxItem,
  type NotificationCategory,
  type NotificationSettings,
} from "../lib/notificationInbox";

const CAT_META: Record<NotificationCategory, { icon: typeof Flame; emoji: string }> = {
  streak: { icon: Flame, emoji: "🔥" },
  achievement: { icon: Trophy, emoji: "🏆" },
  social: { icon: Users, emoji: "👥" },
  tips: { icon: Lightbulb, emoji: "💡" },
};

const FILTER_LABEL_KEY: Record<NotificationCategory | "all", string> = {
  all: "notificationsUi.filterAll",
  streak: "notificationsUi.catStreak",
  achievement: "notificationsUi.catAchievement",
  social: "notificationsUi.catSocial",
  tips: "notificationsUi.catTips",
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
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

  const load = useCallback(async () => {
    const [inbox, s] = await Promise.all([loadInbox(), loadSettings()]);
    setItems(inbox);
    setSettings(s);
    await markAllRead();
  }, []);

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
                <Text style={styles.cardTitle}>
                  {meta.emoji} {item.title}
                </Text>
                <Text style={styles.cardMsg}>{item.body}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.time}>{formatRelativeTime(item.createdAt, t)}</Text>
                  {item.actionLabel && item.actionRoute ? (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                          () => undefined,
                        );
                        try {
                          router.push(item.actionRoute as Href);
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
    [renderRight, router, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/dashboard");
            }
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

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell color={colors.textSecondary} size={40} style={{ marginBottom: spacing.sm }} />
            <Text style={styles.emptyTitle}>{t("notificationsUi.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("notificationsUi.emptySub")}</Text>
          </View>
        }
        renderItem={renderItem}
      />

      {settings ? (
        <View style={styles.settings}>
          <Text style={styles.settingsTitle}>{t("notificationsUi.preferences")}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.streakReminders")}</Text>
            <Switch
              value={settings.streak && settings.frequency !== "off"}
              onValueChange={(v) => updateSetting({ streak: v })}
              trackColor={{ false: "#333", true: "rgba(255,61,0,0.45)" }}
              thumbColor="#fafafa"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("notificationsUi.achievements")}</Text>
            <Switch
              value={settings.achievements && settings.frequency !== "off"}
              onValueChange={(v) => updateSetting({ achievements: v })}
              trackColor={{ false: "#333", true: "rgba(162,89,255,0.45)" }}
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
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
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
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  emptySub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: "center",
  },
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
  rowLabel: { color: colors.textPrimary, ...typography.body },
});
