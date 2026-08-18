import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { sessionSetupStyles as styles } from "./sessionSetup.styles";

export function SessionSetupHeader({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{t("dashboard.newSessionTitle")}</Text>
      {onClose ? (
        <Pressable
          hitSlop={12}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            onClose();
          }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      ) : (
        <View style={styles.closePlaceholder} />
      )}
    </View>
  );
}
