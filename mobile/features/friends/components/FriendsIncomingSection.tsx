import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";

import type { FriendIncomingDto } from "../../../types/friends";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";

type Props = {
  t: TFunction;
  incoming: FriendIncomingDto[];
  actionBusy: number | null;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
};

export function FriendsIncomingSection({ t, incoming, actionBusy, onAccept, onDecline }: Props) {
  if (incoming.length === 0) return null;

  return (
    <View style={styles.sectionWrap}>
      <FriendsSectionHeader
        title={
          incoming.length > 1
            ? t("friendsScreen.incomingTitleCount", { count: incoming.length })
            : t("friendsScreen.incomingTitle")
        }
        subtitle={t("friendsScreen.incomingSectionSub")}
      />
      <View style={styles.incomingList}>
        {incoming.map((req) => (
          <View key={req.id} style={styles.incomingRow}>
            <View style={styles.incomingCopy}>
              <Text style={styles.incomingName}>{req.username}</Text>
              <Text style={styles.incomingHint}>{t("friendsScreen.incomingHint")}</Text>
            </View>
            <View style={styles.incomingActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.smallBtn,
                  styles.acceptBtn,
                  pressed && { opacity: 0.9 },
                ]}
                disabled={actionBusy === req.id}
                onPress={() => onAccept(req.id)}
              >
                <Text style={styles.smallBtnText}>{t("friendsScreen.accept")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.smallBtn,
                  styles.declineBtn,
                  pressed && { opacity: 0.9 },
                ]}
                disabled={actionBusy === req.id}
                onPress={() => onDecline(req.id)}
              >
                <Text style={styles.smallBtnTextDim}>{t("friendsScreen.decline")}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
