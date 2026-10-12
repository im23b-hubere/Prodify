import { UserX } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { Avatar } from "../../../components/ui/Avatar";
import { ScreenTopBar } from "../../../components/ui/ScreenTopBar";
import { colors } from "../../../constants/theme";
import type { BlockedUserDto } from "../../../lib/moderation";
import { profilePictureUrl } from "../../profile/friendProfilePresentation";
import type { BlockedUsersStatus } from "../hooks/useBlockedUsers";
import { blockedUsersStyles as styles } from "./blockedUsers.styles";

type Props = {
  status: BlockedUsersStatus;
  users: BlockedUserDto[];
  unblockingIds: number[];
  onRetry: () => void;
  onUnblock: (user: BlockedUserDto) => void;
  onBack: () => void;
};

export function BlockedUsersView({ status, users, unblockingIds, onRetry, onUnblock, onBack }: Props) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="blocked-users-screen">
      <View style={styles.header}>
        <ScreenTopBar title={t("safety.blocked.title")} subtitle={t("safety.blocked.subtitle")} onBack={onBack} />
      </View>
      {status === "loading" ? <LoadingState message={t("safety.blocked.loading")} /> : null}
      {status === "error" ? (
        <View style={styles.centered}>
          <ErrorState
            title={t("safety.blocked.loadFailedTitle")}
            message={t("safety.blocked.loadFailedBody")}
            retryLabel={t("common.retry")}
            onRetry={onRetry}
          />
        </View>
      ) : null}
      {status === "ready" ? (
        <FlatList
          data={users}
          keyExtractor={(user) => String(user.user_id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              iconNode={<UserX color={colors.textSecondary} size={28} strokeWidth={2} />}
              title={t("safety.blocked.emptyTitle")}
              message={t("safety.blocked.emptyBody")}
            />
          }
          renderItem={({ item }) => (
            <BlockedUserRow
              user={item}
              unblocking={unblockingIds.includes(item.user_id)}
              onUnblock={onUnblock}
            />
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

function BlockedUserRow({
  user,
  unblocking,
  onUnblock,
}: {
  user: BlockedUserDto;
  unblocking: boolean;
  onUnblock: (user: BlockedUserDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View style={styles.row} exiting={FadeOut.duration(180)}>
      <Avatar name={user.username} photoUri={profilePictureUrl(user.profile_picture_url)} size={44} />
      <Text style={styles.username} numberOfLines={1}>
        {user.username}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("safety.blocked.unblockA11y", { name: user.username })}
        accessibilityState={{ busy: unblocking, disabled: unblocking }}
        disabled={unblocking}
        hitSlop={6}
        style={({ pressed }) => [styles.unblockButton, pressed && styles.pressed]}
        onPress={() => onUnblock(user)}
      >
        {unblocking ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={styles.unblockText}>{t("safety.blocked.unblock")}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
