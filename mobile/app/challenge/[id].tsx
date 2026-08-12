import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ChallengeDetailContent } from "../../features/challenges/components/ChallengeDetailContent";
import { ChallengeEditModal } from "../../features/challenges/components/ChallengeEditModal";
import { challengeDetailStyles as styles } from "../../features/challenges/challengeDetail.styles";
import { parseChallengeId } from "../../features/challenges/challengeDetailPresentation";
import { useChallengeDetail } from "../../features/challenges/hooks/useChallengeDetail";

export default function ChallengeDetailScreen() {
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
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("challengeDetail.backA11y")}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={goBack}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <Text style={styles.topTitle}>{t("challengeDetail.title")}</Text>
        <View style={styles.backSpacer} />
      </View>

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
