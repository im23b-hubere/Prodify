import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LevelRankHeroEmblem } from "../components/progression/LevelRankHero";
import { LevelRankRow } from "../components/progression/LevelRankRow";
import { ProgressionOverviewSkeleton } from "../components/progression/ProgressionOverviewSkeleton";
import { ErrorState } from "../components/states/ErrorState";
import { AppCard } from "../components/ui/AppCard";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { fontFamily } from "../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import {
  leaveProgressionOverview,
  parseProgressionOverviewFrom,
  progressionBackLabel,
} from "../lib/progressionNavigation";
import {
  fetchLevelCatalog,
  prefetchLevelCatalog,
  type ProgressionLevelItem,
} from "../lib/progressionLevelCatalog";
import { PROGRESSION_NAMED_LEVEL_MAX, progressionLevelName } from "../lib/progressionLevels";
import { groupLevelsByTier, levelTierFor } from "../lib/progressionLevelTheme";
import { isScreenDataStale } from "../lib/screenDataStale";
import { fetchProgression, syncProgression } from "../lib/progressionSync";
import type { ProgressionDto } from "../types/outcomes";

export default function ProgressionOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const from = parseProgressionOverviewFrom(params.from);
  const backLabel = progressionBackLabel(t, from);
  const { token } = useAuth();
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [levelCatalog, setLevelCatalog] = useState<ProgressionLevelItem[]>([]);
  const [loadingProgression, setLoadingProgression] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);
  const progressionRef = useRef(progression);
  const catalogLenRef = useRef(levelCatalog.length);
  progressionRef.current = progression;
  catalogLenRef.current = levelCatalog.length;

  const load = useCallback(
    async (opts?: { silent?: boolean; sync?: boolean; force?: boolean }) => {
      const silent = opts?.silent ?? false;
      const sync = Boolean(opts?.sync);
      const force = Boolean(opts?.force || sync);

      if (
        !force &&
        !silent &&
        !isScreenDataStale(lastFetchRef.current) &&
        progressionRef.current &&
        catalogLenRef.current > 0
      ) {
        return;
      }

      setLoadError(null);
      if (!token) {
        setProgression(null);
        setLevelCatalog([]);
        setLoadingProgression(false);
        setLoadingCatalog(false);
        setRefreshing(false);
        return;
      }

      prefetchLevelCatalog();

      if (silent) {
        setRefreshing(true);
      } else {
        if (!progressionRef.current) setLoadingProgression(true);
        if (catalogLenRef.current === 0) setLoadingCatalog(true);
      }

      try {
        const progressionPromise = sync
          ? syncProgression(token, { force: true })
          : fetchProgression(token, { force });

        const [raw, catalog] = await Promise.all([
          progressionPromise,
          fetchLevelCatalog(PROGRESSION_NAMED_LEVEL_MAX),
        ]);

        setProgression(raw);
        setLevelCatalog(catalog);
        lastFetchRef.current = Date.now();
      } catch (e) {
        setProgression(null);
        setLevelCatalog([]);
        setLoadError(e instanceof Error ? e.message : t("progression.loadError"));
      } finally {
        setLoadingProgression(false);
        setLoadingCatalog(false);
        setRefreshing(false);
      }
    },
    [token, t],
  );

  useFocusEffect(
    useCallback(() => {
      prefetchLevelCatalog();
      void load();
    }, [load]),
  );

  const level = progression?.current_level ?? 1;
  const nextLevel = level + 1;
  const rankName = useMemo(() => progressionLevelName(t, level), [level, t]);
  const nextRankName = useMemo(() => progressionLevelName(t, nextLevel), [nextLevel, t]);
  const percent = Math.max(0, Math.min(100, progression?.progress_percent ?? 0));
  const graceDays = progression?.decay_grace_days ?? 2;
  const xpPerDay = progression?.decay_xp_per_day ?? 12;
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
            <Text style={styles.decayHint}>
              {t("progression.decayRule", { graceDays: graceDays, xpPerDay: xpPerDay })}
            </Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: ui.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroCard: {
    borderWidth: 1,
  },
  levelTitle: {
    color: colors.textPrimary,
    ...typography.cardTitle,
  },
  tierSections: {
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  tierSection: {
    gap: spacing.sm,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierHeaderText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tierLine: {
    flex: 1,
    height: 1,
  },
  metaLine: {
    color: colors.textSecondary,
    ...typography.meta,
    marginTop: spacing.xs,
  },
  track: {
    marginTop: spacing.sm,
    width: "100%",
    height: 10,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  hint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    ...typography.caption,
  },
  decayHint: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    ...typography.caption,
  },
  levelRows: {
    gap: spacing.xs,
  },
});
