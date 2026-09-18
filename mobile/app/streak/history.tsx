import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenTopBar } from "../../components/ui/ScreenTopBar";
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
      <ScreenTopBar title={t("streakHistory.title")} onBack={goBack} style={styles.topBar} />
      <StreakHistoryContent
        history={history}
        signedIn={Boolean(token)}
        onSignIn={() => router.replace("/(auth)/login" as Href)}
        onStartSession={() => router.push("/session/setup" as Href)}
      />
    </SafeAreaView>
  );
}
