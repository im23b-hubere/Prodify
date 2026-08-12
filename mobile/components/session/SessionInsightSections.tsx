import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  getFocusBenchmark,
  getFocusColor,
  getFocusScoreTips,
  type FocusScoreData,
} from "../../lib/focusScore";
import {
  buildFocusHeadline,
  deriveFocusTier,
  translateInsightItem,
} from "../../lib/sessionInsightsI18n";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";
import { styles } from "./SessionInsightSections.styles";

type Props = {
  session: SessionDto;
  insights: SessionDetailInsightsDto;
  producerName?: string;
};

function focusRing(score: number) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return { size, stroke, r, c, p: Math.max(0.02, Math.min(1, score / 100)) };
}

function translatedLines(
  items: SessionDetailInsightsDto["impact_items"],
  fallback: string[],
  t: TFunction,
): string[] {
  return items?.length ? items.map((item) => translateInsightItem(item, t)) : fallback;
}

function ImpactSection({ lines, t }: { lines: string[]; t: TFunction }) {
  return (
    <View style={[styles.impactCard, styles.impactCardSurface]}>
      <Text style={styles.sectionLabel}>{t("sessionInsights.impact")}</Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.impactLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function focusInput(session: SessionDto, insights: SessionDetailInsightsDto): FocusScoreData {
  return {
    duration_minutes: (session.duration_seconds ?? 0) / 60,
    paused_duration_minutes: insights.paused_seconds / 60,
    session_type: String(session.session_type),
    notes_length: (session.notes ?? "").length,
    mood_level: session.mood_level ?? 3,
  };
}

function FocusSection({ session, insights, t }: Props & { t: TFunction }) {
  const ring = focusRing(insights.focus_score);
  const tips = getFocusScoreTips(focusInput(session, insights), t);
  const benchmark = getFocusBenchmark(insights.focus_score, insights.focus_user_average ?? null, t);
  const tier = insights.focus_tier ?? deriveFocusTier(insights.focus_score);
  return (
    <View style={styles.focusCard}>
      <Text style={styles.sectionLabel}>{t("sessionInsights.focusScore")}</Text>
      <View style={styles.focusRow}>
        <Svg
          width={ring.size}
          height={ring.size}
          style={[styles.ringSvg, { transform: [{ rotate: "-90deg" }] }]}
        >
          <Circle
            cx={ring.size / 2}
            cy={ring.size / 2}
            r={ring.r}
            stroke="#2a2a2a"
            strokeWidth={ring.stroke}
            fill="none"
          />
          <Circle
            cx={ring.size / 2}
            cy={ring.size / 2}
            r={ring.r}
            stroke={getFocusColor(insights.focus_score)}
            strokeWidth={ring.stroke}
            fill="none"
            strokeDasharray={`${ring.c * ring.p} ${ring.c}`}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.focusTextCol}>
          <Text style={styles.focusBig}>{insights.focus_score}%</Text>
          <Text style={styles.focusSub}>{buildFocusHeadline(insights.focus_score, tier, t)}</Text>
          {insights.focus_percentile != null ? (
            <Text style={styles.focusBench}>
              {t("sessionInsights.betterThanPercent", { pct: insights.focus_percentile })}
            </Text>
          ) : null}
          {benchmark ? <Text style={styles.focusBench}>{benchmark}</Text> : null}
          {tips.length ? (
            <View style={styles.tipsBlock}>
              <Text style={styles.tipsTitle}>{t("sessionInsights.tipsTitle")}</Text>
              {tips.map((tip) => (
                <Text key={tip} style={styles.tipLine}>
                  • {tip}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function TimeBreakdown({ insights, t }: { insights: SessionDetailInsightsDto; t: TFunction }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{t("sessionInsights.timeBreakdown")}</Text>
      <Text style={styles.rowLine}>
        {t("sessionInsights.active", { duration: formatDurationWords(insights.active_seconds) })}
      </Text>
      <Text style={styles.rowLine}>
        {t("sessionInsights.paused", { duration: formatDurationWords(insights.paused_seconds) })}
      </Text>
      <Text style={styles.rowLine}>
        {t("sessionInsights.effectiveRate", { pct: insights.effective_rate_percent.toFixed(0) })}
      </Text>
      <View style={styles.timeline}>
        {insights.timeline.map((segment, index) => (
          <View
            key={`${segment.kind}-${index}`}
            style={[
              styles.timelineSeg,
              { flex: Math.max(1, segment.seconds) },
              segment.kind === "paused" ? styles.timelinePaused : styles.timelineActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ProductivitySection({ lines, t }: { lines: string[]; t: TFunction }) {
  if (!lines.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{t("sessionInsights.productivity")}</Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.insightTxt}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function RelatedSessions({ insights, t }: { insights: SessionDetailInsightsDto; t: TFunction }) {
  const router = useRouter();
  if (!insights.related_sessions.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{t("sessionInsights.similarSessions")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.relRow}
      >
        {insights.related_sessions.map((related) => (
          <Pressable
            key={related.id}
            accessibilityRole="link"
            style={styles.relCard}
            onPress={() => router.push(`/session/${related.id}`)}
          >
            <Text style={styles.relType}>{sessionTypeLabel(String(related.session_type), t)}</Text>
            <Text style={styles.relDur}>{formatDurationWords(related.duration_seconds ?? 0)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function SessionInsightSections({ session, insights }: Props) {
  const { t } = useTranslation();
  const impactLines = translatedLines(insights.impact_items, insights.impact_lines, t);
  const productivityLines = translatedLines(
    insights.productivity_items,
    insights.productivity_insights,
    t,
  );
  return (
    <View style={styles.wrap}>
      <ImpactSection lines={impactLines} t={t} />
      <FocusSection session={session} insights={insights} t={t} />
      <TimeBreakdown insights={insights} t={t} />
      <ProductivitySection lines={productivityLines} t={t} />
      <RelatedSessions insights={insights} t={t} />
    </View>
  );
}
