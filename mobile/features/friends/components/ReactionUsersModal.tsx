import { Modal, Pressable, Text } from "react-native";

import type { SocialReactionUserDto } from "../../../types/friends";
import { styles } from "./FriendsModals.styles";

type Props = {
  t: (key: string, options?: Record<string, unknown>) => string;
  open: boolean;
  onClose: () => void;
  loading: boolean;
  users: SocialReactionUserDto[];
};

export function ReactionUsersModal({
  t,
  open: reactionUsersOpen,
  onClose,
  loading: reactionUsersLoading,
  users: reactionUsers,
}: Props) {
  return (
    <Modal
      visible={reactionUsersOpen}
      animationType="fade"
      transparent
      onRequestClose={() => onClose()}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => onClose()}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("friendsScreen.reactionsTitle")}</Text>
          {(reactionUsersLoading
            ? [
                {
                  username: t("friendsScreen.loading"),
                  emoji: "",
                  user_id: -1,
                  created_at: "loading",
                },
              ]
            : reactionUsers.length === 0
              ? [
                  {
                    username: t("friendsScreen.noReactionsYet"),
                    emoji: "",
                    user_id: -1,
                    created_at: "",
                  },
                ]
              : reactionUsers
          ).map((row) => (
            <Text key={`${row.user_id}-${row.created_at}-${row.emoji}`} style={styles.userMeta}>
              {row.emoji} {row.username}
            </Text>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
