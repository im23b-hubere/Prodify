import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Activity, Trophy } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { FlatList, Image, Pressable, Text, View, type ListRenderItem } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EmptyState } from "../../../components/states/EmptyState";
import { colors, spacing } from "../../../constants/theme";
import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../../types/friends";
import { rankColor } from "../utils/friendsScreenFormat";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";

export type FriendsTriggerCard = {
  key: string;
  title: string;
  actionLabel: string;
  onPress: () => void;
};

type Props = {
  t: TFunction;
  mode: "week" | "all";
  setMode: (m: "week" | "all") => void;
  loading: boolean;
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
  activity: FriendActivityDto[];
  renderActivityItem: ListRenderItem<FriendActivityDto>;
  activeTriggerCard: FriendsTriggerCard | null;
  onCompleteTriggerAction: () => void;
  onAddFriendFromEmptyFeed: () => void;
};

export function FriendsOverviewSection({
  t,
  mode,
  setMode,
  loading,
  entries,
  currentUserId,
  activity,
  renderActivityItem,
  activeTriggerCard,
  onCompleteTriggerAction,
  onAddFriendFromEmptyFeed,
}: Props) {
  const router = useRouter();

  const modeOptions = useMemo(
    () => [
      { key: "week" as const, label: t("friendsScreen.modeWeek") },
      { key: "all" as const, label: t("friendsScreen.modeAll") },
    ],
    [t],
  );

  return (
    <>
      <View style={styles.sectionWrap}>
        <FriendsSectionHeader
          icon={<Trophy color={colors.primary} size={20} />}
          title={t("friendsScreen.sectionLeaderboardTitle")}
          subtitle={t("friendsScreen.sectionLeaderboardSub")}
          right={
            <View style={styles.periodToggle}>
              {modeOptions.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === item.key }}
                  style={[styles.periodChip, mode === item.key && styles.periodChipActive]}
                  onPress={() => setMode(item.key)}
                >
                  <Text
                    style={[
                      styles.periodChipText,
                      mode === item.key && styles.periodChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        />
        <View style={styles.cardElevated}>
          {!loading && entries.length === 1 && currentUserId === entries[0]?.user_id ? (
            <Text style={styles.emptyLeader}>{t("friendsScreen.soloLeader")}</Text>
          ) : null}
          {entries.map((entry, idx) => (
            <Animated.View
              key={`${entry.user_id}-${entry.rank}`}
              entering={FadeInDown.delay(idx * 35).duration(320)}
            >
              <Pressable
                style={[styles.leaderItem, idx > 0 && styles.leaderDivider]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  router.push(`/profile/${entry.user_id}`);
                }}
              >
                <View style={[styles.rankBadge, { backgroundColor: rankColor(entry.rank) }]}>
                  <Text style={styles.rankText}>#{entry.rank}</Text>
                </View>
                {entry.profile_picture_url ? (
                  <Image source={{ uri: entry.profile_picture_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLabel}>
                      {entry.username.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.userCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{entry.username}</Text>
                    <Text style={styles.userMeta}>
                      {" "}
                      {entry.streak_status_emoji ?? "🌱"} {entry.streak_status_label ?? "STARTING"}
                    </Text>
                    {entry.is_premium ? <Text style={styles.premiumTag}>PRO</Text> : null}
                    {currentUserId === entry.user_id ? (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>{t("friendsScreen.youPill")}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.userMeta}>
                    {mode === "week"
                      ? t("friendsScreen.metaWeek", {
                          sessions: entry.sessions_in_period,
                          days: entry.current_streak_days,
                        })
                      : t("friendsScreen.metaAll", {
                          sessions: entry.sessions_in_period,
                          days: entry.current_streak_days,
                        })}
                  </Text>
                  <Text style={styles.userMeta}>
                    {entry.trend === "up"
                      ? t("friendsScreen.trendUp")
                      : entry.trend === "down"
                        ? t("friendsScreen.trendDown")
                        : t("friendsScreen.trendStable")}{" "}
                    ·{" "}
                    {entry.is_chasing_you
                      ? t("friendsScreen.statusChasingYou")
                      : entry.is_threatening_you
                        ? t("friendsScreen.statusCloseBehind")
                        : t("friendsScreen.statusDelta", {
                            sign: (entry.sessions_delta_vs_prior ?? 0) >= 0 ? "+" : "",
                            delta: entry.sessions_delta_vs_prior ?? 0,
                          })}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <FriendsSectionHeader
          icon={<Activity color={colors.primary} size={20} />}
          title={t("friendsScreen.sectionActivityTitle")}
          subtitle={t("friendsScreen.sectionActivitySub")}
          right={
            activity.length > 0 ? (
              <View style={styles.activityCountPill}>
                <Text style={styles.activityCountText}>{activity.length}</Text>
              </View>
            ) : null
          }
        />
        {activeTriggerCard ? (
          <View style={styles.cardElevated}>
            <View key={activeTriggerCard.key} style={styles.triggerCardPrimary}>
              <Text style={styles.userName}>{activeTriggerCard.title}</Text>
              <Pressable
                style={styles.triggerActionPrimary}
                onPress={() => {
                  activeTriggerCard.onPress();
                  onCompleteTriggerAction();
                }}
              >
                <Text style={styles.triggerActionTextPrimary}>{activeTriggerCard.actionLabel}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.activityFeedStack}>
          {activity.length === 0 && !loading ? (
            <EmptyState
              icon="🎛️"
              title={t("friendsScreen.feedEmptyTitle")}
              message={t("friendsScreen.feedEmptyMessage")}
              actionLabel={t("friendsScreen.feedEmptyCta")}
              onAction={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onAddFriendFromEmptyFeed();
              }}
            />
          ) : null}
          {activity.length > 0 ? (
            <FlatList
              data={activity}
              keyExtractor={(item) => String(item.session_id)}
              renderItem={renderActivityItem}
              scrollEnabled={false}
              initialNumToRender={6}
              windowSize={7}
              removeClippedSubviews={false}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            />
          ) : null}
        </View>
      </View>
    </>
  );
}
