import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { EmptyState } from "../../../components/states/EmptyState";
import { API_BASE_URL } from "../../../constants/api";
import type { FriendsOverviewProps } from "./FriendsOverviewSection";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsOverviewStyles as styles } from "../styles/friendsOverview.styles";

function sessionsBehind(
  entry: FriendsOverviewProps["entries"][number],
  entries: FriendsOverviewProps["entries"],
) {
  const ahead = entries.find((item) => item.rank === entry.rank - 1);
  if (!ahead) return null;
  const count = ahead.sessions_in_period - entry.sessions_in_period;
  if (count <= 0) return null;
  return { count, name: ahead.username };
}

export function FriendsLeaderboardSection({ props }: { props: FriendsOverviewProps }) {
  const router = useRouter();
  const visible = useMemo(() => {
    const top = props.entries.slice(0, 8);
    const you = props.entries.find((entry) => entry.user_id === props.currentUserId);
    if (!you || top.some((entry) => entry.user_id === you.user_id)) return top;
    return [...top, you];
  }, [props.currentUserId, props.entries]);
  const solo =
    !props.loading && visible.length === 1 && props.currentUserId === visible[0]?.user_id;
  return (
    <View style={styles.sectionWrap} testID="friends-ranking">
      <FriendsSectionHeader
        title={props.t("friendsScreen.sectionLeaderboardTitle")}
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
        {visible.map((entry, index) => (
          <LeaderRow
            key={`${entry.user_id}-${entry.rank}`}
            entry={entry}
            index={index}
            gap={sessionsBehind(entry, props.entries)}
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
  gap,
  props,
  onOpen,
}: {
  entry: FriendsOverviewProps["entries"][number];
  index: number;
  gap: { count: number; name: string } | null;
  props: FriendsOverviewProps;
  onOpen: () => void;
}) {
  const uri = entry.profile_picture_url?.trim()
    ? entry.profile_picture_url.startsWith("http")
      ? entry.profile_picture_url
      : `${API_BASE_URL}${entry.profile_picture_url}`
    : null;
  const isYou = props.currentUserId === entry.user_id;
  return (
    <Pressable
      style={[styles.leaderItem, index > 0 && styles.leaderDivider, isYou && styles.leaderItemYou]}
      onPress={onOpen}
    >
      <Text
        style={[
          styles.rankNumber,
          styles.rankNumberRegular,
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
          <Text style={[styles.userName, styles.leaderName]} numberOfLines={1}>
            {entry.username}
          </Text>
          {isYou ? (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>{props.t("friendsScreen.youPill")}</Text>
            </View>
          ) : null}
        </View>
        {gap ? (
          <Text style={styles.leaderGap} numberOfLines={1}>
            {props.t("friendsScreen.leaderGapBehind", { count: gap.count, name: gap.name })}
          </Text>
        ) : null}
      </View>
      <Text style={styles.leaderScore}>{entry.sessions_in_period}</Text>
    </Pressable>
  );
}
