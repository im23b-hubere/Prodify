import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { StreakHistoryContent } from "../../features/streak/components/StreakHistoryContent";
import { useStreakHistory } from "../../features/streak/hooks/useStreakHistory";
import { styles } from "../../features/streak/streakHistory.styles";

export default function StreakHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const history = useStreakHistory(token, t("streakHistory.loadError"));
  const goBack = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("streakHistory.backA11y")}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={goBack}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <Text style={styles.title}>{t("streakHistory.title")}</Text>
        <View style={styles.backSpacer} />
      </View>
      <StreakHistoryContent
        history={history}
        signedIn={Boolean(token)}
        onSignIn={() => router.replace("/(auth)/login" as Href)}
        onStartSession={() => router.push("/session/setup" as Href)}
      />
    </SafeAreaView>
  );
}
