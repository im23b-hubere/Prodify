import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Mic, Share2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import {
  getFocusBenchmark,
  getFocusColor,
  getFocusScoreTips,
  type FocusScoreData,
} from "../../lib/focusScore";
import { formatDurationWords } from "../../lib/sessionTime";
import type { SessionDetailInsightsDto } from "../../types/insights";
import type { SessionDto } from "../../types/session";

import { SessionShareImageModal } from "./SessionShareImageModal";

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

export function SessionInsightSections({ session, insights, producerName }: Props) {
  const router = useRouter();
  const [shareImageOpen, setShareImageOpen] = useState(false);
  const ring = useMemo(() => focusRing(insights.focus_score), [insights.focus_score]);
  const ringColor = useMemo(() => getFocusColor(insights.focus_score), [insights.focus_score]);

  const focusInput = useMemo((): FocusScoreData => {
    return {
      duration_minutes: (session.duration_seconds ?? 0) / 60,
      paused_duration_minutes: insights.paused_seconds / 60,
      session_type: String(session.session_type),
      notes_length: (session.notes ?? "").length,
      mood_level: session.mood_level ?? 3,
    };
  }, [session, insights.paused_seconds]);

  const focusTips = useMemo(() => getFocusScoreTips(focusInput), [focusInput]);
  const benchmark = useMemo(
    () => getFocusBenchmark(insights.focus_score, insights.focus_user_average ?? null),
    [insights.focus_score, insights.focus_user_average],
  );

  const shareMinimal = useMemo(() => {
    const dur = session.duration_seconds ?? 0;
    return `${session.session_type} · ${formatDurationWords(dur)} · Prodify`;
  }, [session]);

  const shareBold = useMemo(
    () =>
      `🔥 ${session.session_type.toUpperCase()}\n⏱ ${formatDurationWords(session.duration_seconds ?? 0)}\n— Prodify`,
    [session],
  );

  const shareGradient = useMemo(
    () =>
      `✨ Session recap\n${session.session_type}\n${formatDurationWords(session.duration_seconds ?? 0)}\nFocus ${insights.focus_score}%\nProdify`,
    [session, insights.focus_score],
  );

  const onShare = async (body: string) => {
    await Share.share({ message: body });
  };

  return (
    <View style={styles.wrap}>
      <SessionShareImageModal
        visible={shareImageOpen}
        onClose={() => setShareImageOpen(false)}
        session={session}
        insights={insights}
        producerName={producerName}
      />
      <LinearGradient
        colors={["rgba(255,61,0,0.15)", "rgba(162,89,255,0.12)"]}
        style={styles.impactCard}
      >
        <Text style={styles.sectionLabel}>Session impact</Text>
        {insights.impact_lines.map((line) => (
          <Text key={line} style={styles.impactLine}>
            {line}
          </Text>
        ))}
      </LinearGradient>

      <View style={styles.focusCard}>
        <Text style={styles.sectionLabel}>Focus score</Text>
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
              stroke={ringColor}
              strokeWidth={ring.stroke}
              fill="none"
              strokeDasharray={`${ring.c * ring.p} ${ring.c}`}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.focusTextCol}>
            <Text style={styles.focusBig}>{insights.focus_score}%</Text>
            <Text style={styles.focusSub}>{insights.focus_label}</Text>
            {insights.focus_percentile != null ? (
              <Text style={styles.focusBench}>
                Better than {insights.focus_percentile}% of your sessions
              </Text>
            ) : null}
            {benchmark ? <Text style={styles.focusBench}>{benchmark}</Text> : null}
            {focusTips.length > 0 ? (
              <View style={styles.tipsBlock}>
                <Text style={styles.tipsTitle}>Tips for next session</Text>
                {focusTips.map((tip) => (
                  <Text key={tip} style={styles.tipLine}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Time breakdown</Text>
        <Text style={styles.rowLine}>Active: {formatDurationWords(insights.active_seconds)}</Text>
        <Text style={styles.rowLine}>Paused: {formatDurationWords(insights.paused_seconds)}</Text>
        <Text style={styles.rowLine}>
          Effective rate: {insights.effective_rate_percent.toFixed(0)}%
        </Text>
        <View style={styles.timeline}>
          {insights.timeline.map((seg, i) => (
            <View
              key={`${seg.kind}-${i}`}
              style={[
                styles.timelineSeg,
                { flex: Math.max(1, seg.seconds) },
                seg.kind === "paused" ? styles.timelinePaused : styles.timelineActive,
              ]}
            />
          ))}
        </View>
      </View>

      {insights.productivity_insights.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Productivity insights</Text>
          {insights.productivity_insights.map((t) => (
            <Text key={t} style={styles.insightTxt}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}

      {insights.related_sessions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Similar sessions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relRow}
          >
            {insights.related_sessions.map((s) => (
              <Pressable
                key={s.id}
                style={styles.relCard}
                onPress={() => router.push(`/session/${s.id}`)}
              >
                <Text style={styles.relType}>{s.session_type}</Text>
                <Text style={styles.relDur}>{formatDurationWords(s.duration_seconds ?? 0)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Audio</Text>
        <Pressable style={styles.audioBtn} disabled>
          <Mic color={colors.textSecondary} size={20} />
          <Text style={styles.audioTxt}>Add audio snippet</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTxt}>Coming soon</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Share</Text>
        <Pressable style={styles.storyBtn} onPress={() => setShareImageOpen(true)}>
          <Share2 size={18} color={colors.textPrimary} />
          <Text style={styles.storyBtnTxt}>Story-Bild (PNG)</Text>
        </Pressable>
        <View style={styles.shareRow}>
          <Pressable style={styles.shareChip} onPress={() => onShare(shareMinimal)}>
            <Share2 size={16} color={colors.textPrimary} />
            <Text style={styles.shareChipTxt}>Text · Minimal</Text>
          </Pressable>
          <Pressable style={styles.shareChip} onPress={() => onShare(shareBold)}>
            <Text style={styles.shareChipTxt}>Text · Bold</Text>
          </Pressable>
          <Pressable style={styles.shareChip} onPress={() => onShare(shareGradient)}>
            <Text style={styles.shareChipTxt}>Text · Lang</Text>
          </Pressable>
        </View>
        <Pressable style={styles.copyBtn} onPress={() => onShare(shareMinimal)}>
          <Text style={styles.copyBtnTxt}>Copy stats as text</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  impactCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  impactLine: { color: colors.textPrimary, ...typography.body, marginBottom: 6 },
  focusCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  focusRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  ringSvg: { transform: [{ rotate: "0deg" }] },
  focusTextCol: { flex: 1, gap: 4 },
  focusBig: { fontSize: 36, fontFamily: fontFamily.heading, color: colors.textPrimary },
  focusSub: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  focusBench: { color: colors.textSecondary, ...typography.caption },
  tipsBlock: { marginTop: spacing.sm, gap: 4 },
  tipsTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  tipLine: { color: colors.textSecondary, ...typography.caption },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  rowLine: { color: colors.textPrimary, ...typography.body, marginBottom: 4 },
  timeline: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  timelineSeg: { height: "100%" },
  timelineActive: { backgroundColor: colors.primary },
  timelinePaused: { backgroundColor: "rgba(255,255,255,0.2)" },
  insightTxt: { color: colors.textSecondary, ...typography.caption, marginBottom: 6 },
  relRow: { gap: spacing.sm, paddingVertical: 4 },
  relCard: {
    width: 140,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  relType: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  relDur: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    opacity: 0.65,
  },
  audioTxt: { color: colors.textSecondary, ...typography.body, flex: 1 },
  comingSoon: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
  },
  comingSoonTxt: { color: colors.secondary, ...typography.caption, fontSize: 11 },
  storyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(162,89,255,0.18)",
    borderWidth: 1,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
  },
  storyBtnTxt: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  shareRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  shareChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  shareChipTxt: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  copyBtn: { marginTop: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  copyBtnTxt: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.body },
});
