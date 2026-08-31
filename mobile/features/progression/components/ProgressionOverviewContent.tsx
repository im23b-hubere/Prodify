import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { ProgressionOverviewSkeleton } from "../../../components/progression/ProgressionOverviewSkeleton";
import { ErrorState } from "../../../components/states/ErrorState";
import { AppCard } from "../../../components/ui/AppCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { colors } from "../../../constants/theme";
import type { ProgressionLevelItem } from "../../../lib/progressionLevelCatalog";
import { groupLevelsByTier } from "../../../lib/progressionLevelTheme";
import type { ProgressionOverviewState } from "../hooks/useProgressionOverview";
import { styles } from "../progressionOverview.styles";
import { ProgressionHero } from "./ProgressionHero";
import { ProgressionRankCatalog } from "./ProgressionRankCatalog";

type Props = {
  overview: ProgressionOverviewState;
  signedIn: boolean;
  backLabel: string;
  onBack: () => void;
  onSignIn: () => void;
};

export function ProgressionOverviewContent(props: Props) {
  const { t } = useTranslation();
  const tierGroups = useMemo(
    () => groupLevelsByTier(props.overview.levelCatalog),
    [props.overview.levelCatalog],
  );
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={progressionRefreshControl(props)}
    >
      <ScreenHeader
        title={t("progression.overviewTitle")}
        subtitle={t("progression.overviewSubtitle")}
        actionLabel={props.backLabel}
        onActionPress={props.onBack}
      />
      <ProgressionFeedback {...props} />
      <ProgressionHero
        progression={props.overview.progression}
        loadError={props.overview.loadError}
      />
      <ProgressionCatalogState props={props} tierGroups={tierGroups} />
    </ScrollView>
  );
}

type TierGroups = ReturnType<typeof groupLevelsByTier<ProgressionLevelItem>>;

function progressionRefreshControl(props: Props) {
  if (!props.signedIn) return undefined;
  return (
    <RefreshControl
      refreshing={props.overview.refreshing}
      onRefresh={() => void props.overview.load({ silent: true, sync: true, force: true })}
      tintColor={colors.primary}
    />
  );
}

function ProgressionCatalogState({ props, tierGroups }: { props: Props; tierGroups: TierGroups }) {
  const { overview, signedIn } = props;
  const currentLevel = overview.progression?.current_level ?? null;
  const state = progressionCatalogVisibility({
    signedIn,
    loadError: overview.loadError,
    loading: overview.loadingCatalog,
    catalogLength: overview.levelCatalog.length,
    groupCount: tierGroups.length,
    hasProgression: currentLevel != null,
  });
  const showBack = Boolean(overview.progression) || tierGroups.length > 0;
  return (
    <>
      {state === "loading" && !(overview.loadingProgression && !overview.progression) ? (
        <ProgressionOverviewSkeleton hero={false} rankRows={8} />
      ) : null}
      {currentLevel != null ? (
        <ProgressionRankCatalog
          groups={tierGroups}
          currentLevel={currentLevel}
          visible={state === "ready"}
        />
      ) : null}
      {showBack ? <PrimaryButton label={props.backLabel} onPress={props.onBack} /> : null}
    </>
  );
}

type CatalogVisibilityOptions = {
  signedIn: boolean;
  loadError: string | null;
  loading: boolean;
  catalogLength: number;
  groupCount: number;
  hasProgression: boolean;
};

function progressionCatalogVisibility(options: CatalogVisibilityOptions) {
  if (!options.signedIn || options.loadError) return "hidden";
  if (options.loading && options.catalogLength === 0) return "loading";
  if (!options.hasProgression) return "hidden";
  return options.groupCount > 0 ? "ready" : "hidden";
}

function ProgressionFeedback({ overview, signedIn, onSignIn }: Props) {
  const { t } = useTranslation();
  if (!signedIn) {
    return (
      <AppCard>
        <Text style={styles.levelTitle}>{t("progression.needSignInTitle")}</Text>
        <Text style={styles.metaLine}>{t("progression.needSignInBody")}</Text>
        <PrimaryButton label={t("progression.signInCta")} onPress={onSignIn} />
      </AppCard>
    );
  }
  if (overview.loadError) {
    return (
      <ErrorState
        title={t("common.oops")}
        message={overview.loadError}
        retryLabel={t("common.tryAgain")}
        onRetry={() => void overview.load({ force: true })}
      />
    );
  }
  if (overview.loadingProgression && !overview.progression) {
    return (
      <View testID="progression-overview-loading">
        <ProgressionOverviewSkeleton hero rankRows={overview.loadingCatalog ? 8 : 0} />
      </View>
    );
  }
  if (!overview.progression) {
    return (
      <ErrorState
        title={t("common.oops")}
        message={t("progression.loadError")}
        retryLabel={t("common.tryAgain")}
        onRetry={() => void overview.load({ force: true })}
      />
    );
  }
  return null;
}
