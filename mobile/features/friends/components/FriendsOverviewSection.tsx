import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Activity, Trophy } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { API_BASE_URL } from "../../../constants/api";
import { EmptyState } from "../../../components/states/EmptyState";
import { LoadingState } from "../../../components/states/LoadingState";
import { colors, spacing } from "../../../constants/theme";
import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../../types/friends";
import { FriendsLeaderboardPodium } from "./FriendsLeaderboardPodium";
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
  renderActivity: (item: FriendActivityDto, index: number) => ReactNode;
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
  renderActivity,
  activeTriggerCard,
  onCompleteTriggerAction,
  onAddFriendFromEmptyFeed,
}: Props) {
  const router = useRouter();
  const avatarUri = (uri?: string | null) =>
    uri?.trim() ? (uri.startsWith("http") ? uri : `${API_BASE_URL}${uri}`) : null;
  const visibleEntries = useMemo(() => entries.slice(0, 8), [entries]);
  const showSoloState =
    !loading && visibleEntries.length === 1 && currentUserId === visibleEntries[0]?.user_id;
  const showPodium = !showSoloState && visibleEntries.length >= 2;
  const listEntries = useMemo(
    () => (showPodium ? visibleEntries.filter((entry) => entry.rank > 3) : visibleEntries),
    [showPodium, visibleEntries],
  );

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
        <Animated.View
          key={`leaderboard-${mode}`}
          entering={FadeIn.duration(220)}
          style={styles.cardElevated}
        >
          {showSoloState ? (
            <Text style={styles.emptyLeader}>{t("friendsScreen.soloLeader")}</Text>
          ) : null}
          {!loading && visibleEntries.length === 0 ? (
            <EmptyState
              compact
              title={t("friendsScreen.leaderboardEmptyTitle")}
              message={t("friendsScreen.leaderboardEmptyMessage")}
              actionLabel={t("friendsScreen.leaderboardEmptyCta")}
              onAction={onAddFriendFromEmptyFeed}
            />
          ) : null}
          {showPodium ? (
            <FriendsLeaderboardPodium
              t={t}
              mode={mode}
              entries={visibleEntries}
              currentUserId={currentUserId}
            />
          ) : null}
          {listEntries.map((entry, idx) => (
            <Animated.View
              key={`${entry.user_id}-${entry.rank}`}
              entering={FadeInDown.delay(idx * 35).duration(320)}
            >
              <Pressable
                style={[
                  styles.leaderItem,
                  idx > 0 && styles.leaderDivider,
                  entry.rank <= 3 && styles.leaderTopRow,
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  router.push(`/profile/${entry.user_id}`);
                }}
              >
                <Text
                  style={[
                    styles.rankNumber,
                    entry.rank <= 3 ? styles.rankNumberTop : styles.rankNumberRegular,
                    entry.rank === 1 && styles.rankNumberGold,
                    entry.rank === 2 && styles.rankNumberSilver,
                    entry.rank === 3 && styles.rankNumberBronze,
                  ]}
                >
                  {entry.rank}
                </Text>
                {avatarUri(entry.profile_picture_url) ? (
                  <Image
                    source={{ uri: avatarUri(entry.profile_picture_url) as string }}
                    style={styles.avatarImage}
                  />
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
                    {currentUserId === entry.user_id ? (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>{t("friendsScreen.youPill")}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.leaderMetricsRow}>
                    <View style={styles.leaderMetricPill}>
                      <Text style={styles.leaderMetricLabel}>
                        {mode === "week"
                          ? t("friendsScreen.leaderMetricSessionsWeek")
                          : t("friendsScreen.leaderMetricSessionsAll")}
                      </Text>
                      <Text style={styles.leaderMetricValue}>{entry.sessions_in_period}</Text>
                    </View>
                    <View style={styles.leaderMetricPill}>
                      <Text style={styles.leaderMetricLabel}>
                        {t("friendsScreen.statStreakLabel")}
                      </Text>
                      <Text style={styles.leaderMetricValue}>
                        {t("friendsScreen.leaderMetricStreakDays", {
                          days: entry.current_streak_days,
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>
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
          {loading ? <LoadingState message={t("friendsScreen.loading")} /> : null}
          {activity.length === 0 && !loading ? (
            <EmptyState
              compact
              iconNode={<Activity color={colors.primary} size={32} />}
              title={t("friendsScreen.activityFeedEmptyTitle")}
              message={t("friendsScreen.activityFeedEmptyMessage")}
            />
          ) : null}
          {activity.length > 0 ? (
            <View style={styles.activityFeedStack}>
              {activity.map((item, index) => (
                <View
                  key={`${item.user_id}-${item.session_id}-${item.activity_at}`}
                  style={index > 0 ? { marginTop: spacing.sm } : undefined}
                >
                  {renderActivity(item, index)}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </>
  );
}
