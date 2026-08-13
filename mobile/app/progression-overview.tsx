import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { ProgressionOverviewContent } from "../features/progression/components/ProgressionOverviewContent";
import { useProgressionOverview } from "../features/progression/hooks/useProgressionOverview";
import { styles } from "../features/progression/progressionOverview.styles";
import {
  leaveProgressionOverview,
  parseProgressionOverviewFrom,
  progressionBackLabel,
} from "../lib/progressionNavigation";

export default function ProgressionOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = parseProgressionOverviewFrom(params.from);
  const { token } = useAuth();
  const overview = useProgressionOverview(token, t("progression.loadError"));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ProgressionOverviewContent
        overview={overview}
        signedIn={Boolean(token)}
        backLabel={progressionBackLabel(t, from)}
        onBack={() => leaveProgressionOverview(router, from)}
        onSignIn={() => router.replace("/(auth)/login" as Href)}
      />
    </SafeAreaView>
  );
}
