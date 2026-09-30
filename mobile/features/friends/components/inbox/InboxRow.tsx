import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { PressableScale } from "../../../../components/ui/PressableScale";
import { colors } from "../../../../constants/theme";
import { friendsInboxStyles as styles } from "../../styles/friendsInbox.styles";

const AVATAR_SIZE = 44;

export type InboxPendingAction = "accept" | "decline" | null;

type Props = {
  name: string;
  photoUri: string | null;
  meta: string;
  acceptLabel: string;
  declineLabel: string;
  /** The answer being sent: that button shows a spinner, both stay disabled until it settles. */
  pendingAction: InboxPendingAction;
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
  pendingAction,
  divided,
  onAccept,
  onDecline,
  testID,
}: Props) {
  const busy = pendingAction !== null;
  const accepting = pendingAction === "accept";
  const declining = pendingAction === "decline";
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
        accessibilityLabel={`${declineLabel}, ${name}`}
        accessibilityState={{ disabled: busy, busy: declining }}
        style={({ pressed }) => [styles.declineBtn, pressed && styles.actionPressed]}
        disabled={busy}
        hitSlop={6}
        onPress={onDecline}
        testID={`${testID}-decline`}
      >
        <Text style={[styles.declineText, declining && styles.labelHidden]}>{declineLabel}</Text>
        {declining ? (
          <ActivityIndicator
            style={styles.declineSpinner}
            size="small"
            color={colors.textSecondary}
            testID={`${testID}-decline-spinner`}
          />
        ) : null}
      </Pressable>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${acceptLabel}, ${name}`}
        accessibilityState={{ disabled: busy, busy: accepting }}
        style={styles.acceptPill}
        disabled={busy}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onAccept();
        }}
        testID={`${testID}-accept`}
      >
        {accepting ? (
          <ActivityIndicator
            size="small"
            color={colors.textPrimary}
            testID={`${testID}-accept-spinner`}
          />
        ) : (
          <Text style={styles.acceptPillText}>{acceptLabel}</Text>
        )}
      </PressableScale>
    </View>
  );
}
