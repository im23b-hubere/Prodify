import { type Href, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";
import { AppCard } from "../components/ui/AppCard";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import { colors, radii, spacing, typography, ui } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../lib/client";
import { syncProgression } from "../lib/progressionSync";
import type { ProgressionDto } from "../types/outcomes";

/** Keep >= backend `XP_LEVEL_CATALOG_MAX` (default catalog depth). */
const LEVEL_CATALOG_MIN_DEPTH = 20;
const LEVEL_CATALOG_MAX_QUERY = 200;

type ProgressionLevelItem = {
  level: number;
  xp_start: number;
  xp_end_exclusive: number;
  xp_span: number;
};

function parseLevelCatalog(raw: unknown): ProgressionLevelItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const v = item as Record<string, unknown>;
      if (
        typeof v.level !== "number" ||
        typeof v.xp_start !== "number" ||
        typeof v.xp_end_exclusive !== "number" ||
        typeof v.xp_span !== "number"
      ) {
        return null;
      }
      return {
        level: v.level,
        xp_start: v.xp_start,
        xp_end_exclusive: v.xp_end_exclusive,
        xp_span: v.xp_span,
      } satisfies ProgressionLevelItem;
    })
    .filter((x): x is ProgressionLevelItem => x !== null)
    .sort((a, b) => a.level - b.level);
}

export default function ProgressionOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [levelCatalog, setLevelCatalog] = useState<ProgressionLevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setLoadError(null);
      if (!token) {
        setProgression(null);
        setLevelCatalog([]);
        if (!silent) setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const raw = await syncProgression(token, { force: true });
        setProgression(raw);
        const levelNow = raw?.current_level ?? 1;
        const catalogDepth = Math.min(
          LEVEL_CATALOG_MAX_QUERY,
          Math.max(LEVEL_CATALOG_MIN_DEPTH, levelNow),
        );
        const catalogRaw = await apiJson<unknown>(`/progression/levels?max_level=${catalogDepth}`, {
          token,
        }).catch(() => []);
        setLevelCatalog(parseLevelCatalog(catalogRaw));
      } catch (e) {
        setProgression(null);
        setLevelCatalog([]);
        setLoadError(e instanceof Error ? e.message : t("progression.loadError"));
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const level = progression?.current_level ?? 1;
  const percent = Math.max(0, Math.min(100, progression?.progress_percent ?? 0));
  const graceDays = progression?.decay_grace_days ?? 2;
  const xpPerDay = progression?.decay_xp_per_day ?? 12;

  const showInitialLoading = loading && !progression && !loadError;
  const showProgressionContent = Boolean(token) && !loadError && !showInitialLoading;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          token ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load({ silent: true })}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        <ScreenHeader
          title={t("progression.overviewTitle")}
          subtitle={t("progression.overviewSubtitle")}
          actionLabel={t("progression.backToStats")}
          onActionPress={() => router.push("/(tabs)/stats")}
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
            onRetry={() => void load()}
          />
        ) : null}

        {token && showInitialLoading ? <LoadingState message={t("progression.loading")} /> : null}

        {showProgressionContent ? (
          <>
            <AppCard>
              <Text style={styles.levelTitle}>{t("progression.levelTitle", { level })}</Text>
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
                  percent: Math.round(percent),
                  xp: progression?.xp_to_next_level ?? 0,
                  next: level + 1,
                })}
              >
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.metaLine}>
                {t("progression.toNext", {
                  xp: progression?.xp_to_next_level ?? 50,
                  level: level + 1,
                  percent: Math.round(percent),
                })}
              </Text>
              <Text style={styles.hint}>{t("progression.overviewHint")}</Text>
              <Text style={styles.decayHint}>
                {t("progression.decayRule", { graceDays: graceDays, xpPerDay: xpPerDay })}
              </Text>
            </AppCard>

            {levelCatalog.length > 0 ? (
              <AppCard>
                <Text style={styles.levelTitle}>{t("progression.allLevelsTitle")}</Text>
                <View style={styles.levelRows}>
                  {levelCatalog.map((entry) => {
                    const active = entry.level === level;
                    return (
                      <View
                        key={entry.level}
                        style={[styles.levelRow, active && styles.levelRowActive]}
                      >
                        <View style={styles.levelRowHeader}>
                          <Text
                            style={[styles.levelRowTitle, active && styles.levelRowTitleActive]}
                          >
                            {t("progression.levelRowLabel", { level: entry.level })}
                          </Text>
                          {active ? (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>
                                {t("progression.currentBadge")}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.levelRowMeta}>
                          {t("progression.levelRowRange", {
                            start: entry.xp_start,
                            end: entry.xp_end_exclusive - 1,
                            span: entry.xp_span,
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </AppCard>
            ) : null}

            <PrimaryButton
              label={t("progression.backToStats")}
              onPress={() => router.push("/(tabs)/stats")}
            />
          </>
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
  levelTitle: {
    color: colors.textPrimary,
    ...typography.cardTitle,
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
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  levelRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  levelRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  levelRowActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  levelRowTitle: {
    color: colors.textPrimary,
    ...typography.meta,
  },
  levelRowTitleActive: {
    fontWeight: "700",
  },
  levelRowMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  currentBadge: {
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  currentBadgeText: {
    color: "#ffffff",
    ...typography.caption,
    fontWeight: "700",
  },
});
