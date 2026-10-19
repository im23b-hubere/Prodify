import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "../../../components/ui/Avatar";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { profilePictureUrl } from "../../profile/friendProfilePresentation";
import type { FriendPathCluster } from "../clusterFriendsByLevel";

type Props = {
  cluster: FriendPathCluster | null;
  onClose: () => void;
  onOpenFriend: (userId: number) => void;
};

/** List of friends sharing one rank node — opened from a stacked marker. */
export function FriendPathClusterSheet({ cluster, onClose, onOpenFriend }: Props) {
  const { t } = useTranslation();
  const open = cluster != null;

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>
            {cluster
              ? t("progression.path.friendClusterTitle", { level: cluster.level })
              : ""}
          </Text>
          <ScrollView style={styles.list} bounces={false}>
            {(cluster?.all ?? []).map((friend) => (
              <Pressable
                key={friend.user_id}
                accessibilityRole="button"
                accessibilityLabel={friend.username}
                onPress={() => {
                  onClose();
                  onOpenFriend(friend.user_id);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Avatar
                  name={friend.username}
                  photoUri={profilePictureUrl(friend.profile_picture_url)}
                  size={40}
                />
                <Text style={styles.name}>{friend.username}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.rowPressed]}
          >
            <Text style={styles.closeLabel}>{t("progression.info.close")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "55%",
    gap: spacing.md,
  },
  title: {
    ...typography.cardTitle,
    fontFamily: fontFamily.heading,
    color: colors.textPrimary,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: { opacity: 0.7 },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
  },
  close: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  closeLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: fontFamily.heading,
  },
});
