import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DashboardRecentSessionRow } from "../../../components/dashboard/DashboardRecentSessionRow";
import { EmptyState } from "../../../components/states/EmptyState";
import { fontFamily } from "../../../constants/fonts";
import { colors, spacing, typography } from "../../../constants/theme";
import { formatSessionListDate } from "../../../lib/sessionTime";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SessionDto } from "../../../types/session";
import { STATS_SESSION_LOG_PREVIEW } from "../constants";
import type { StatsPeriod } from "../types";
import { StatsSection } from "./StatsSection";

type Props = {
  t: TFunction;
  sessions: SessionDto[];
  statsPeriod: StatsPeriod;
  onStartSession: () => void;
};

export function StatsSessionLogSection({ t, sessions, statsPeriod, onStartSession }: Props) {
  const router = useRouter();
  const preview = sessions.slice(0, STATS_SESSION_LOG_PREVIEW);
  const subtitle =
    sessions.length > 0
      ? sessions.length > STATS_SESSION_LOG_PREVIEW
        ? t("stats.recentCountSubtitle", {
            shown: preview.length,
            total: sessions.length,
          })
        : t("stats.recentSubtitle")
      : undefined;

  return (
    <StatsSection title={t("stats.recentTitle")} subtitle={subtitle} testID="stats-section-recent">
      {sessions.length === 0 ? (
        <EmptyState
          compact
          title={t("stats.recentEmptyTitle")}
          message={t("stats.recentEmpty")}
          actionLabel={t("common.startSession")}
          onAction={onStartSession}
        />
      ) : (
        <>
          <View style={styles.list}>
            {preview.map((item) => {
              const typeLabel = sessionTypeLabel(String(item.session_type ?? "beat_making"), t);
              const sid =
                typeof item.id === "number" && Number.isFinite(item.id) && item.id > 0
                  ? item.id
                  : null;
              return (
                <DashboardRecentSessionRow
                  key={sid != null ? `recent-${sid}` : `recent-${item.started_at}`}
                  session={item}
                  typeLabel={typeLabel}
                  accessibilityLabel={`${typeLabel}, ${formatSessionListDate(item.started_at)}`}
                  accessibilityHint={t("dashboard.openSessionDetailsA11y")}
                  onPress={() => {
                    if (sid == null) return;
                    router.push(`/session/${sid}`);
                  }}
                />
              );
            })}
          </View>
          {sessions.length > STATS_SESSION_LOG_PREVIEW ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/session/history",
                  params: { period: statsPeriod },
                })
              }
              style={({ pressed }) => [styles.viewAll, pressed && { opacity: 0.88 }]}
            >
              <Text style={styles.viewAllText}>{t("stats.viewAllSessions")}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  list: {
    marginBottom: spacing.xs,
  },
  viewAll: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  viewAllText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
});
