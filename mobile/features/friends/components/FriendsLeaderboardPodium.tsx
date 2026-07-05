import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { memo, useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { API_BASE_URL } from "../../../constants/api";
import type { FriendLeaderboardEntryDto } from "../../../types/friends";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";

type Props = {
  t: TFunction;
  mode: "week" | "all";
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
};

function podiumStyle(rank: number) {
  if (rank === 1) return styles.podiumGold;
  if (rank === 2) return styles.podiumSilver;
  return styles.podiumBronze;
}

function rankTextStyle(rank: number) {
  if (rank === 1) return styles.rankNumberGold;
  if (rank === 2) return styles.rankNumberSilver;
  return styles.rankNumberBronze;
}

export const FriendsLeaderboardPodium = memo(function FriendsLeaderboardPodium({
  t,
  mode,
  entries,
  currentUserId,
}: Props) {
  const router = useRouter();
  const avatarUri = (uri?: string | null) =>
    uri?.trim() ? (uri.startsWith("http") ? uri : `${API_BASE_URL}${uri}`) : null;

  const ordered = useMemo(() => {
    const top = entries.filter((entry) => entry.rank <= 3).sort((a, b) => a.rank - b.rank);
    if (top.length === 3) return [top[1], top[0], top[2]];
    return top;
  }, [entries]);

  if (ordered.length < 2) return null;

  return (
    <View style={styles.podiumGrid} testID="friends-leaderboard-podium">
      {ordered.map((entry, idx) => {
        const uri = avatarUri(entry.profile_picture_url);
        const isFirst = entry.rank === 1;
        return (
          <Animated.View
            key={`podium-${entry.user_id}`}
            entering={FadeInDown.delay(idx * 50).duration(300)}
            style={[styles.podiumCell, isFirst && { marginTop: 0 }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("friendsScreen.activityOpenProfileA11y", {
                name: entry.username,
              })}
              style={({ pressed }) => [
                styles.podiumCard,
                podiumStyle(entry.rank),
                { alignItems: "center" },
                isFirst && { paddingVertical: 14 },
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                router.push(`/profile/${entry.user_id}`);
              }}
            >
              <Text style={[styles.rankNumberTop, rankTextStyle(entry.rank)]}>#{entry.rank}</Text>
              {uri ? (
                <Image source={{ uri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>
                    {entry.username.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.userName} numberOfLines={1}>
                {entry.username}
              </Text>
              {currentUserId === entry.user_id ? (
                <View style={styles.youPill}>
                  <Text style={styles.youPillText}>{t("friendsScreen.youPill")}</Text>
                </View>
              ) : null}
              <Text style={[styles.rankNumberTop, rankTextStyle(entry.rank)]}>
                {entry.sessions_in_period}
              </Text>
              <Text style={styles.userMeta}>
                {mode === "week"
                  ? t("friendsScreen.leaderMetricSessionsWeek")
                  : t("friendsScreen.leaderMetricSessionsAll")}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
});
