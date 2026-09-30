import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { PressableScale } from "../../../../components/ui/PressableScale";
import { colors } from "../../../../constants/theme";
import { friendsInboxStyles as styles } from "../../styles/friendsInbox.styles";

const AVATAR_SIZE = 44;

type Props = {
  name: string;
  photoUri: string | null;
  meta: string;
  acceptLabel: string;
  declineLabel: string;
  /** The accept button shows a spinner; both buttons are disabled while `busy`. */
  accepting: boolean;
  busy: boolean;
  divided: boolean;
  onAccept: () => void;
  onDecline: () => void;
  testID: string;
};

/** One request waiting for this user: who sent it, what it is, decline quietly or accept. */
export function InboxRow({
  name,
  photoUri,
  meta,
  acceptLabel,
  declineLabel,
  accepting,
  busy,
  divided,
  onAccept,
  onDecline,
  testID,
}: Props) {
  return (
    <View style={[styles.row, styles.inboxRow]} testID={testID}>
      {divided ? <View style={styles.rowDivider} /> : null}
      <Avatar name={name} photoUri={photoUri} size={AVATAR_SIZE} ring="accent" />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={declineLabel}
        accessibilityState={{ disabled: busy }}
        style={({ pressed }) => [styles.declineBtn, pressed && styles.actionPressed]}
        disabled={busy}
        hitSlop={6}
        onPress={onDecline}
      >
        <Text style={styles.declineText}>{declineLabel}</Text>
      </Pressable>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={acceptLabel}
        accessibilityState={{ disabled: busy, busy: accepting }}
        style={styles.acceptPill}
        disabled={busy}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onAccept();
        }}
      >
        {accepting ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={styles.acceptPillText}>{acceptLabel}</Text>
        )}
      </PressableScale>
    </View>
  );
}
