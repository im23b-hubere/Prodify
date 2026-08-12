import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LevelRankHeroEmblem } from "../components/progression/LevelRankHero";
import { LevelRankRow } from "../components/progression/LevelRankRow";
import { ProgressionOverviewSkeleton } from "../components/progression/ProgressionOverviewSkeleton";
import { ErrorState } from "../components/states/ErrorState";
import { AppCard } from "../components/ui/AppCard";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useProgressionOverview } from "../features/progression/hooks/useProgressionOverview";
import { styles } from "../features/progression/progressionOverview.styles";
import {
  leaveProgressionOverview,
  parseProgressionOverviewFrom,
  progressionBackLabel,
} from "../lib/progressionNavigation";
import { progressionLevelName } from "../lib/progressionLevels";
import { groupLevelsByTier, levelTierFor } from "../lib/progressionLevelTheme";

export default function ProgressionOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = parseProgressionOverviewFrom(params.from);
  const backLabel = progressionBackLabel(t, from);
  const { token } = useAuth();
  const {
    progression,
    levelCatalog,
    loadingProgression,
    loadingCatalog,
    refreshing,
    loadError,
    load,
  } = useProgressionOverview(token, t("progression.loadError"));

  const level = progression?.current_level ?? 1;
  const nextLevel = level + 1;
  const rankName = useMemo(() => progressionLevelName(t, level), [level, t]);
  const nextRankName = useMemo(() => progressionLevelName(t, nextLevel), [nextLevel, t]);
  const percent = Math.max(0, Math.min(100, progression?.progress_percent ?? 0));
  const currentTier = useMemo(() => levelTierFor(level), [level]);
  const tierGroups = useMemo(() => groupLevelsByTier(levelCatalog), [levelCatalog]);

  const showFullSkeleton =
    Boolean(token) && !loadError && loadingProgression && !progression && loadingCatalog;
  const showHero = Boolean(token) && !loadError && progression != null;
  const showRanksSkeleton =
    Boolean(token) && !loadError && loadingCatalog && levelCatalog.length === 0;
  const showRanks = Boolean(token) && !loadError && levelCatalog.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          token ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load({ silent: true, sync: true, force: true })}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        <ScreenHeader
          title={t("progression.overviewTitle")}
          subtitle={t("progression.overviewSubtitle")}
          actionLabel={backLabel}
          onActionPress={() => leaveProgressionOverview(router, from)}
        />

        {!token ? (
          <AppCard>
            <Text style={styles.levelTitle}>{t("progression.needSignInTitle")}</Text>
            <Text style={styles.metaLine}>{t("progression.needSignInBody")}</Text>
            <PrimaryButton
              label={t("progression.signInCta")}
              onPress={() => router.replace("/(auth)/login" as Href)}
            />
          </AppCard>
        ) : null}

        {token && loadError ? (
          <ErrorState
            title={t("common.oops")}
            message={loadError}
            retryLabel={t("common.tryAgain")}
            onRetry={() => void load({ force: true })}
          />
        ) : null}

        {showFullSkeleton ? <ProgressionOverviewSkeleton hero rankRows={8} /> : null}

        {showHero ? (
          <AppCard style={[styles.heroCard, { borderColor: currentTier.accentSoft }]}>
            <LevelRankHeroEmblem level={level} t={t} />
            <Text style={styles.metaLine}>
              {t("progression.xpTotal", { xp: progression?.xp_total ?? 0 })}
            </Text>
            <View
              style={styles.track}
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(percent),
              }}
              accessibilityLabel={t("progression.progressBarA11y", {
                name: rankName,
                percent: Math.round(percent),
                xp: progression?.xp_to_next_level ?? 0,
                nextName: nextRankName,
              })}
            >
              <View
                style={[styles.fill, { width: `${percent}%`, backgroundColor: currentTier.accent }]}
              />
            </View>
            <Text style={styles.metaLine}>
              {t("progression.toNext", {
                xp: progression?.xp_to_next_level ?? 50,
                nextName: nextRankName,
                percent: Math.round(percent),
              })}
            </Text>
            <Text style={styles.hint}>{t("progression.overviewHint")}</Text>
            <Text style={styles.decayHint}>{t("progression.decayRule")}</Text>
          </AppCard>
        ) : null}

        {showRanksSkeleton ? <ProgressionOverviewSkeleton hero={false} rankRows={8} /> : null}

        {showRanks ? (
          <AppCard>
            <Text style={styles.levelTitle}>{t("progression.allLevelsTitle")}</Text>
            <View style={styles.tierSections}>
              {tierGroups.map(({ tier, levels: tierLevels }) => (
                <View key={tier.id} style={styles.tierSection}>
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierDot, { backgroundColor: tier.accent }]} />
                    <Text style={[styles.tierHeaderText, { color: tier.accent }]}>
                      {t(tier.labelKey)}
                    </Text>
                    <View style={[styles.tierLine, { backgroundColor: tier.accentSoft }]} />
                  </View>
                  <View style={styles.levelRows}>
                    {tierLevels.map((entry) => (
                      <LevelRankRow key={entry.level} entry={entry} currentLevel={level} t={t} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </AppCard>
        ) : null}

        {showHero || showRanks ? (
          <PrimaryButton label={backLabel} onPress={() => leaveProgressionOverview(router, from)} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
