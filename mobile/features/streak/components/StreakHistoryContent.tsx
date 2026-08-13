import { Calendar } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text } from "react-native";

import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { AppCard } from "../../../components/ui/AppCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import { HISTORY_FETCH_LIMIT, type StreakHistoryState } from "../hooks/useStreakHistory";
import { styles } from "../streakHistory.styles";
import { StreakRunCard } from "./StreakRunCard";

type Props = {
  history: StreakHistoryState;
  signedIn: boolean;
  onSignIn: () => void;
  onStartSession: () => void;
};

export function StreakHistoryContent({ history, signedIn, onSignIn, onStartSession }: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        signedIn ? (
          <RefreshControl
            refreshing={history.refreshing}
            onRefresh={history.refresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      <HistoryFeedback
        history={history}
        signedIn={signedIn}
        onSignIn={onSignIn}
        onStartSession={onStartSession}
      />
      <HistoryRuns history={history} signedIn={signedIn} />
    </ScrollView>
  );
}

function HistoryFeedback({ history, signedIn, onSignIn, onStartSession }: Props) {
  const { t } = useTranslation();
  if (history.loading && !history.refreshing) {
    return <LoadingState message={t("streakHistory.loading")} />;
  }
  if (!signedIn) return <SignInCard onSignIn={onSignIn} />;
  if (history.error) {
    return (
      <ErrorState
        title={t("common.oops")}
        message={history.error}
        retryLabel={t("common.tryAgain")}
        onRetry={history.retry}
      />
    );
  }
  if (history.runs.length === 0) {
    return (
      <EmptyState
        iconNode={<Calendar color={colors.primary} size={40} />}
        title={t("streakHistory.emptyTitle")}
        message={t("streakHistory.emptySub")}
        actionLabel={t("streakHistory.emptyCta")}
        onAction={onStartSession}
      />
    );
  }
  return null;
}

function HistoryRuns({ history, signedIn }: Pick<Props, "history" | "signedIn">) {
  const { t } = useTranslation();
  if (!signedIn || history.loading || history.error || history.runs.length === 0) return null;
  return (
    <>
      {history.runs.map((run, index) => (
        <StreakRunCard
          key={`${run.start_date}-${run.end_date}-${index}`}
          run={run}
          index={index}
          currentStreak={history.currentStreak}
        />
      ))}
      <Text style={styles.footnote}>
        {t("streakHistory.footnote", { limit: HISTORY_FETCH_LIMIT })}
      </Text>
    </>
  );
}

function SignInCard({ onSignIn }: Pick<Props, "onSignIn">) {
  const { t } = useTranslation();
  return (
    <AppCard>
      <Text style={styles.cardTitle}>{t("streakHistory.needSignInTitle")}</Text>
      <Text style={styles.cardBody}>{t("streakHistory.needSignInBody")}</Text>
      <PrimaryButton label={t("streakHistory.signInCta")} onPress={onSignIn} />
    </AppCard>
  );
}
