import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Check } from "lucide-react-native";
import { memo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { Avatar } from "../../../components/ui/Avatar";
import { PressableScale } from "../../../components/ui/PressableScale";
import { colors } from "../../../constants/theme";
import type { FriendDuelStatus } from "../challengeDraft";
import { type ChallengeFriendOption, matchesFriendSearch } from "../challengeFriends";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";

const SEARCH_THRESHOLD = 6;
const AVATAR_SIZE = 68;

type Props = {
  t: TFunction;
  friends: ChallengeFriendOption[];
  statuses: Map<number, FriendDuelStatus>;
  selectedFriendId: number | null;
  onSelect: (friendId: number) => void;
  onAddFriend: () => void;
};

export function FriendStep({
  t,
  friends,
  statuses,
  selectedFriendId,
  onSelect,
  onAddFriend,
}: Props) {
  const [query, setQuery] = useState("");

  if (friends.length === 0) {
    return (
      <EmptyState
        title={t("challengeCreate.noFriendsTitle")}
        message={t("challengeCreate.noFriendsMessage")}
        actionLabel={t("challengeCreate.addFriend")}
        onAction={onAddFriend}
      />
    );
  }

  const visible = friends.filter((friend) => matchesFriendSearch(friend, query));
  return (
    <>
      {friends.length > SEARCH_THRESHOLD ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("challengeCreate.searchPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t("challengeCreate.searchPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.search}
        />
      ) : null}
      {visible.length === 0 ? (
        <Text style={styles.mutedText}>
          {t("challengeCreate.noSearchResults", { query: query.trim() })}
        </Text>
      ) : (
        <View style={styles.grid} accessibilityRole="radiogroup">
          {visible.map((friend) => (
            <FriendTile
              key={friend.userId}
              t={t}
              friend={friend}
              status={statuses.get(friend.userId) ?? "available"}
              selected={friend.userId === selectedFriendId}
              onSelect={onSelect}
            />
          ))}
        </View>
      )}
    </>
  );
}

type TileProps = {
  t: TFunction;
  friend: ChallengeFriendOption;
  status: FriendDuelStatus;
  selected: boolean;
  onSelect: (friendId: number) => void;
};

const FriendTile = memo(function FriendTile({ t, friend, status, selected, onSelect }: TileProps) {
  const blocked = status === "invite_pending";
  const statusLabel = friendStatusLabel(status, t);
  return (
    <View style={styles.tileCell}>
      <PressableScale
        style={[styles.tile, blocked && styles.tileDimmed]}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: blocked }}
        accessibilityLabel={statusLabel ? `${friend.username}, ${statusLabel}` : friend.username}
        disabled={blocked}
        testID={`challenge-friend-${friend.userId}`}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onSelect(friend.userId);
        }}
      >
        <View>
          <Avatar
            name={friend.username}
            photoUri={friend.photoUri}
            size={AVATAR_SIZE}
            ring={selected ? "accent" : "none"}
          />
          {selected ? (
            <View style={styles.checkBadge}>
              <Check size={14} color={colors.textPrimary} strokeWidth={3} />
            </View>
          ) : null}
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {friend.username}
        </Text>
        {statusLabel ? (
          <Text
            style={[styles.tileStatus, status === "in_duel" && styles.tileStatusLive]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        ) : null}
      </PressableScale>
    </View>
  );
});

function friendStatusLabel(status: FriendDuelStatus, t: TFunction) {
  if (status === "invite_pending") return t("challengeCreate.statusInvitePending");
  if (status === "in_duel") return t("challengeCreate.statusInDuel");
  return null;
}
