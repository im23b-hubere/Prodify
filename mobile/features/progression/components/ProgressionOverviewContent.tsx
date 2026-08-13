import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text } from "react-native";

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
  const state = progressionCatalogVisibility({
    signedIn,
    loadError: overview.loadError,
    loading: overview.loadingCatalog,
    catalogLength: overview.levelCatalog.length,
    groupCount: tierGroups.length,
  });
  const showBack = Boolean(overview.progression) || tierGroups.length > 0;
  return (
    <>
      {state === "loading" ? <ProgressionOverviewSkeleton hero={false} rankRows={8} /> : null}
      <ProgressionRankCatalog
        groups={tierGroups}
        currentLevel={overview.progression?.current_level ?? 1}
        visible={state === "ready"}
      />
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
};

function progressionCatalogVisibility(options: CatalogVisibilityOptions) {
  if (!options.signedIn || options.loadError) return "hidden";
  if (options.loading && options.catalogLength === 0) return "loading";
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
  const showFullSkeleton =
    overview.loadingProgression && !overview.progression && overview.loadingCatalog;
  return showFullSkeleton ? <ProgressionOverviewSkeleton hero rankRows={8} /> : null;
}
