import { Modal, Pressable, Text, TextInput } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import { styles } from "./FriendsModals.styles";

type Props = {
  t: (key: string, options?: Record<string, unknown>) => string;
  open: boolean;
  onClose: () => void;
  username: string;
  onUsernameChange: (value: string) => void;
  busy: boolean;
  onSend: () => void;
};

export function AddFriendModal({
  t,
  open: addOpen,
  onClose,
  username: addName,
  onUsernameChange: setAddName,
  busy: addBusy,
  onSend: sendRequest,
}: Props) {
  const setAddOpen = (value: boolean) => {
    if (!value) onClose();
  };
  return (
    <Modal
      visible={addOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setAddOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("friendsScreen.modalTitle")}</Text>
          <Text style={styles.modalHint}>{t("friendsScreen.modalHint")}</Text>
          <TextInput
            value={addName}
            onChangeText={setAddName}
            placeholder={t("friendsScreen.placeholderUsername")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <PrimaryButton
            label={addBusy ? t("friendsScreen.sendingRequest") : t("friendsScreen.sendRequest")}
            onPress={() => sendRequest()}
            disabled={addBusy}
          />
          <Pressable style={styles.modalCancel} onPress={() => setAddOpen(false)}>
            <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
