import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "../../../components/ui/Avatar";
import { fontFamily } from "../../../constants/fonts";
import { colors } from "../../../constants/theme";
import { profilePictureUrl } from "../../profile/friendProfilePresentation";
import type { FriendPathCluster } from "../clusterFriendsByLevel";
import type { RankPathLayout } from "../rankPathLayout";

const AVATAR = 36;
const STACK_OFFSET = 14;
const HIT = 48;
/** Sit clearly under the rank medallion so markers are not covered by the node. */
const BELOW_NODE = 52;

type Props = {
  layout: RankPathLayout;
  clusters: FriendPathCluster[];
  onOpenFriend: (userId: number) => void;
  onOpenCluster: (cluster: FriendPathCluster) => void;
};

/** Friend avatar pins on rank nodes; stacks + `+N` when several share a level. */
export function RankPathFriendMarkers({
  layout,
  clusters,
  onOpenFriend,
  onOpenCluster,
}: Props) {
  const { t } = useTranslation();
  if (clusters.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.layer]}
      testID="rank-path-friend-markers"
    >
      {clusters.map((cluster) => {
        const node = layout.nodes[cluster.level - 1];
        if (!node) return null;
        const isSingle = cluster.all.length === 1;
        const front = cluster.visible[0]!;
        const label = isSingle
          ? t("progression.path.friendMarkerA11y", {
              name: front.username,
              level: cluster.level,
            })
          : t("progression.path.friendClusterA11y", {
              count: cluster.all.length,
              level: cluster.level,
            });
        const stackWidth =
          AVATAR + Math.max(0, cluster.visible.length - 1) * STACK_OFFSET + (cluster.overflowCount > 0 ? 30 : 0);

        return (
          <Pressable
            key={cluster.level}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              if (isSingle) onOpenFriend(front.user_id);
              else onOpenCluster(cluster);
            }}
            style={({ pressed }) => [
              styles.hit,
              {
                left: node.x - stackWidth / 2,
                top: node.y + BELOW_NODE,
                width: Math.max(HIT, stackWidth),
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <View style={[styles.stack, { width: stackWidth }]}>
              {cluster.visible.map((friend, index) => (
                <View
                  key={friend.user_id}
                  style={[
                    styles.avatarWrap,
                    {
                      left: index * STACK_OFFSET,
                      zIndex: cluster.visible.length - index,
                    },
                  ]}
                >
                  <Avatar
                    name={friend.username}
                    photoUri={profilePictureUrl(friend.profile_picture_url)}
                    size={AVATAR}
                    ring="accent"
                  />
                </View>
              ))}
              {cluster.overflowCount > 0 ? (
                <View
                  style={[
                    styles.overflow,
                    { left: cluster.visible.length * STACK_OFFSET + 2 },
                  ]}
                >
                  <Text style={styles.overflowText}>
                    {t("progression.path.friendOverflow", { count: cluster.overflowCount })}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 20,
    elevation: 20,
  },
  hit: {
    position: "absolute",
    height: HIT,
    justifyContent: "center",
  },
  stack: {
    height: AVATAR + 4,
  },
  avatarWrap: {
    position: "absolute",
    top: 0,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.surface,
  },
  overflow: {
    position: "absolute",
    top: 6,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 11,
  },
});
