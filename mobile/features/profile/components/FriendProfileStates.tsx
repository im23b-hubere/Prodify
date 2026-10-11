import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { friendProfileStyles as styles } from "../friendProfile.styles";
import type { PendingDirection } from "../hooks/useFriendProfile";
import { ProfileAvatar } from "./FriendProfileHero";

/** Placeholder in the shape of the hero and the first sections, so nothing jumps when data lands. */
export function FriendProfileSkeleton({ label }: { label: string }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity, reducedMotion]);

  const breathe = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[styles.skeleton, breathe]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID="friend-profile-skeleton"
    >
      <View style={styles.skeletonAvatar} />
      <View style={[styles.skeletonLine, styles.skeletonName]} />
      <View style={[styles.skeletonLine, styles.skeletonMeta]} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </Animated.View>
  );
}

type LockedProps = {
  username: string | null;
  isPending: boolean;
  pendingDirection: PendingDirection | null;
  isSending: boolean;
  onSendRequest: (username: string) => void;
  onOpenFriends: () => void;
};

export function LockedProfile({
  username,
  isPending,
  pendingDirection,
  isSending,
  onSendRequest,
  onOpenFriends,
}: LockedProps) {
  const { t } = useTranslation();
  const message = !isPending
    ? t("friendProfile.lockedNone")
    : pendingDirection === "incoming"
      ? t("friendProfile.lockedPendingIncoming")
      : t("friendProfile.lockedPendingOutgoing");

  return (
    <View style={styles.locked} testID="friend-profile-locked">
      <ProfileAvatar username={username ?? "?"} pictureUrl={null} streak={0} />
      <Text style={styles.username} accessibilityRole="header">
        {username ? t("friendProfile.lockedUserHeading", { name: username }) : t("friendProfile.lockedTitle")}
      </Text>
      <Text style={styles.lockedMessage}>{message}</Text>
      <View style={styles.lockedActions}>
        <LockedPrimaryAction
          username={username}
          isPending={isPending}
          pendingDirection={pendingDirection}
          isSending={isSending}
          onSendRequest={onSendRequest}
          onOpenFriends={onOpenFriends}
        />
        {isPending && pendingDirection === "incoming" ? null : (
          <Pressable accessibilityRole="button" style={styles.textAction} onPress={onOpenFriends}>
            <Text style={styles.textActionLabel}>{t("friendProfile.friendsTab")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function LockedPrimaryAction({
  username,
  isPending,
  pendingDirection,
  isSending,
  onSendRequest,
  onOpenFriends,
}: LockedProps) {
  const { t } = useTranslation();
  if (isPending && pendingDirection === "incoming") {
    return <PrimaryButton label={t("friendProfile.openRequestCta")} onPress={onOpenFriends} />;
  }
  if (isPending) {
    return (
      <View style={styles.pendingPill}>
        <Text style={styles.pendingPillText}>{t("profileHeader.requestPending")}</Text>
      </View>
    );
  }
  if (!username) return null;
  return (
    <PrimaryButton
      label={t("profileHeader.addFriend")}
      loading={isSending}
      onPress={() => onSendRequest(username)}
      testID="friend-profile-add-friend"
    />
  );
}
