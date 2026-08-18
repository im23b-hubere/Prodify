import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Trophy } from "lucide-react-native";
import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { EmptyState } from "../../../components/states/EmptyState";
import { API_BASE_URL } from "../../../constants/api";
import { colors } from "../../../constants/theme";
import type { FriendsOverviewProps } from "./FriendsOverviewSection";
import { FriendsLeaderboardPodium } from "./FriendsLeaderboardPodium";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsOverviewStyles as styles } from "../styles/friendsOverview.styles";

export function FriendsLeaderboardSection({ props }: { props: FriendsOverviewProps }) {
  const router = useRouter();
  const visible = useMemo(() => props.entries.slice(0, 8), [props.entries]);
  const solo =
    !props.loading && visible.length === 1 && props.currentUserId === visible[0]?.user_id;
  const podium = !solo && visible.length >= 2;
  const list = useMemo(
    () => (podium ? visible.filter((entry) => entry.rank > 3) : visible),
    [podium, visible],
  );
  return (
    <View style={styles.sectionWrap}>
      <FriendsSectionHeader
        icon={<Trophy color={colors.primary} size={20} />}
        title={props.t("friendsScreen.sectionLeaderboardTitle")}
        subtitle={props.t("friendsScreen.sectionLeaderboardSub")}
        right={<PeriodToggle props={props} />}
      />
      <Animated.View
        key={`leaderboard-${props.mode}`}
        entering={FadeIn.duration(220)}
        style={styles.cardElevated}
      >
        {solo ? (
          <Text style={styles.emptyLeader}>{props.t("friendsScreen.soloLeader")}</Text>
        ) : null}
        {!props.loading && visible.length === 0 ? (
          <EmptyState
            compact
            title={props.t("friendsScreen.leaderboardEmptyTitle")}
            message={props.t("friendsScreen.leaderboardEmptyMessage")}
            actionLabel={props.t("friendsScreen.leaderboardEmptyCta")}
            onAction={props.onAddFriendFromEmptyFeed}
          />
        ) : null}
        {podium ? (
          <FriendsLeaderboardPodium
            t={props.t}
            mode={props.mode}
            entries={visible}
            currentUserId={props.currentUserId}
          />
        ) : null}
        {list.map((entry, index) => (
          <LeaderRow
            key={`${entry.user_id}-${entry.rank}`}
            entry={entry}
            index={index}
            props={props}
            onOpen={() => {
              Haptics.selectionAsync().catch(() => undefined);
              router.push(`/profile/${entry.user_id}`);
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function PeriodToggle({ props }: { props: FriendsOverviewProps }) {
  const options = [
    { key: "week" as const, label: props.t("friendsScreen.modeWeek") },
    { key: "all" as const, label: props.t("friendsScreen.modeAll") },
  ];
  return (
    <View style={styles.periodToggle}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityState={{ selected: props.mode === option.key }}
          style={[styles.periodChip, props.mode === option.key && styles.periodChipActive]}
          onPress={() => props.setMode(option.key)}
        >
          <Text
            style={[
              styles.periodChipText,
              props.mode === option.key && styles.periodChipTextActive,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LeaderRow({
  entry,
  index,
  props,
  onOpen,
}: {
  entry: FriendsOverviewProps["entries"][number];
  index: number;
  props: FriendsOverviewProps;
  onOpen: () => void;
}) {
  const uri = entry.profile_picture_url?.trim()
    ? entry.profile_picture_url.startsWith("http")
      ? entry.profile_picture_url
      : `${API_BASE_URL}${entry.profile_picture_url}`
    : null;
  return (
    <Animated.View entering={FadeInDown.delay(index * 35).duration(320)}>
      <Pressable
        style={[
          styles.leaderItem,
          index > 0 && styles.leaderDivider,
          entry.rank <= 3 && styles.leaderTopRow,
        ]}
        onPress={onOpen}
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
        {uri ? (
          <Image source={{ uri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{entry.username.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.userCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{entry.username}</Text>
            {props.currentUserId === entry.user_id ? (
              <View style={styles.youPill}>
                <Text style={styles.youPillText}>{props.t("friendsScreen.youPill")}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.leaderMetricsRow}>
            <View style={styles.leaderMetricPill}>
              <Text style={styles.leaderMetricLabel}>
                {props.t(
                  props.mode === "week"
                    ? "friendsScreen.leaderMetricSessionsWeek"
                    : "friendsScreen.leaderMetricSessionsAll",
                )}
              </Text>
              <Text style={styles.leaderMetricValue}>{entry.sessions_in_period}</Text>
            </View>
            <View style={styles.leaderMetricPill}>
              <Text style={styles.leaderMetricLabel}>
                {props.t("friendsScreen.statStreakLabel")}
              </Text>
              <Text style={styles.leaderMetricValue}>
                {props.t("friendsScreen.leaderMetricStreakDays", {
                  days: entry.current_streak_days,
                })}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
