import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenTopBar } from "../../components/ui/ScreenTopBar";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { ChallengeDetailContent } from "../../features/challenges/components/ChallengeDetailContent";
import { ChallengeEditModal } from "../../features/challenges/components/ChallengeEditModal";
import { challengeDetailStyles as styles } from "../../features/challenges/challengeDetail.styles";
import { parseChallengeId } from "../../features/challenges/challengeDetailPresentation";
import { useChallengeDetail } from "../../features/challenges/hooks/useChallengeDetail";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";

export default function ChallengeDetailRoute() {
  return (
    <AppAccessGate>
      <ChallengeDetailScreen />
    </AppAccessGate>
  );
}

function ChallengeDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const detail = useChallengeDetail(token, parseChallengeId(params.id), user?.id);
  const goBack = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenTopBar title={t("challengeDetail.title")} onBack={goBack} style={styles.topBar} />

      {detail.loading && !detail.refreshing ? (
        <View style={styles.centerState}>
          <LoadingState message={t("challengeDetail.loading")} />
        </View>
      ) : null}
      {!detail.loading && detail.error ? (
        <View style={styles.centerState}>
          <ErrorState
            title={t("challengeDetail.loadErrorTitle")}
            message={detail.error}
            onRetry={() => void detail.load()}
            retryLabel={t("challengeDetail.retry")}
          />
        </View>
      ) : null}
      {!detail.loading && !detail.error && detail.challenge ? (
        <ChallengeDetailContent detail={detail} currentUserId={user?.id} />
      ) : null}
      <ChallengeEditModal detail={detail} />
    </SafeAreaView>
  );
}
