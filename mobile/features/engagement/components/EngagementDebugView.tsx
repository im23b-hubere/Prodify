import { Sprout } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../../components/states/EmptyState";
import { ErrorState } from "../../../components/states/ErrorState";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ScreenTopBar } from "../../../components/ui/ScreenTopBar";
import { colors } from "../../../constants/theme";
import {
  type EngagementDebug,
  type EngagementDebugCandidate,
  isColdStart,
  SESSIONS_TO_LEAVE_COLD_START,
} from "../../../lib/engagementDebug";
import {
  formatHour,
  formatMoment,
  formatPercent,
  formatSigned,
  formatWindow,
  significantParts,
} from "../engagementDebugFormat";
import type { EngagementDebugStatus } from "../hooks/useEngagementDebug";
import { EngagementDebugSkeleton } from "./EngagementDebugSkeleton";
import { engagementDebugStyles as styles } from "./engagementDebug.styles";

type Props = {
  status: EngagementDebugStatus;
  debug: EngagementDebug | null;
  isEvaluating: boolean;
  onRetry: () => void;
  onEvaluate: () => void;
  onBack: () => void;
};

export function EngagementDebugView({
  status,
  debug,
  isEvaluating,
  onRetry,
  onEvaluate,
  onBack,
}: Props) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="engagement-debug-screen">
      <View style={styles.header}>
        <ScreenTopBar
          title={t("engagementDebug.title")}
          subtitle={t("engagementDebug.subtitle")}
          onBack={onBack}
        />
      </View>
      {status === "loading" ? (
        <EngagementDebugSkeleton label={t("engagementDebug.loading")} />
      ) : null}
      {status === "error" ? (
        <View style={styles.centered}>
          <ErrorState
            title={t("engagementDebug.errorTitle")}
            message={t("engagementDebug.errorBody")}
            retryLabel={t("common.retry")}
            onRetry={onRetry}
          />
        </View>
      ) : null}
      {status === "ready" && debug ? (
        <ScrollView contentContainerStyle={styles.content}>
          {isColdStart(debug) ? (
            <EmptyState
              iconNode={<Sprout color={colors.textSecondary} size={28} strokeWidth={2} />}
              title={t("engagementDebug.coldStartTitle")}
              message={t("engagementDebug.coldStartBody", { count: SESSIONS_TO_LEAVE_COLD_START })}
            />
          ) : null}
          <DecisionCard decision={debug.decision} />
          <PrimaryButton
            label={t("engagementDebug.evaluate")}
            onPress={onEvaluate}
            loading={isEvaluating}
            disabled={isEvaluating}
          />
          <CandidatesSection
            candidates={debug.candidates}
            chosenType={debug.decision.chosen_type}
          />
          <LearningSection debug={debug} />
          <ProfileSection debug={debug} />
          <LastPushSection lastDelivery={debug.last_delivery} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Animated.View style={styles.section} entering={FadeIn.duration(220)}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Animated.View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function DecisionCard({ decision }: { decision: EngagementDebug["decision"] }) {
  const { t } = useTranslation();
  const sends = decision.should_send;
  return (
    <Section title={t("engagementDebug.decisionTitle")}>
      <View style={[styles.card, sends && styles.cardChosen]}>
        <View style={styles.decisionHeader}>
          <Text style={styles.decisionTitle}>
            {decision.chosen_type ?? t("engagementDebug.nothingChosen")}
          </Text>
          <View style={[styles.pill, sends ? styles.pillSend : styles.pillSkip]}>
            <Text style={[styles.pillText, sends ? styles.pillTextSend : styles.pillTextSkip]}>
              {sends ? t("engagementDebug.send") : t("engagementDebug.skip")}
            </Text>
          </View>
        </View>
        <Text style={styles.body}>{decision.reason}</Text>
        {decision.scheduled_at && !sends ? (
          <Text style={styles.muted}>
            {t("engagementDebug.scheduledAt", { time: formatMoment(decision.scheduled_at) })}
          </Text>
        ) : null}
      </View>
    </Section>
  );
}

function CandidatesSection({
  candidates,
  chosenType,
}: {
  candidates: EngagementDebugCandidate[];
  chosenType: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Section title={t("engagementDebug.candidatesTitle")}>
      {candidates.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{t("engagementDebug.noCandidates")}</Text>
        </View>
      ) : (
        candidates.map((candidate) => (
          <CandidateCard
            key={candidate.type}
            candidate={candidate}
            isChosen={candidate.type === chosenType}
          />
        ))
      )}
    </Section>
  );
}

function CandidateCard({
  candidate,
  isChosen,
}: {
  candidate: EngagementDebugCandidate;
  isChosen: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.card, isChosen && styles.cardChosen]}
      testID={`engagement-candidate-${candidate.type}`}
    >
      <View style={styles.candidateHeader}>
        <Text style={styles.candidateType}>{candidate.type}</Text>
        <Text style={styles.candidateScore}>{candidate.total}</Text>
      </View>
      <Text style={styles.body}>
        {candidate.title} · {candidate.body}
      </Text>
      <Text style={styles.muted}>{candidate.reason}</Text>
      <View style={styles.divider} />
      {significantParts(candidate.parts).map(([part, value]) => (
        <Row key={part} label={part} value={formatSigned(value)} />
      ))}
      <View style={styles.divider} />
      <Row label={t("engagementDebug.verdict")} value={candidate.verdict} />
    </View>
  );
}

function LearningSection({ debug }: { debug: EngagementDebug }) {
  const { t } = useTranslation();
  const none = t("engagementDebug.none");
  const sendHour = debug.preferred_notification_hour;
  return (
    <Section title={t("engagementDebug.learningTitle")}>
      <View style={styles.card}>
        <Row label={t("engagementDebug.fatigue")} value={String(Math.round(debug.fatigue_score))} />
        <Row label={t("engagementDebug.ignoredStreak")} value={String(debug.ignored_streak)} />
        <Row
          label={t("engagementDebug.sendHour")}
          value={sendHour === null ? none : formatHour(sendHour)}
        />
        <Row label={t("engagementDebug.segment")} value={debug.segment ?? none} />
        <Row
          label={t("engagementDebug.returnProbability")}
          value={
            debug.return_probability_24h === null
              ? none
              : formatPercent(debug.return_probability_24h)
          }
        />
        <View style={styles.divider} />
        {Object.entries(debug.motivation).map(([category, rate]) => (
          <Row key={category} label={category} value={formatPercent(rate)} />
        ))}
      </View>
    </Section>
  );
}

function ProfileSection({ debug }: { debug: EngagementDebug }) {
  const { t } = useTranslation();
  const { profile, production_window: window } = debug;
  const none = t("engagementDebug.none");
  return (
    <Section title={t("engagementDebug.profileTitle")}>
      <View style={styles.card}>
        <Row label={t("engagementDebug.stage")} value={String(profile.stage)} />
        <Row label={t("engagementDebug.sessions")} value={String(profile.total_sessions)} />
        <Row
          label={t("engagementDebug.perWeek")}
          value={profile.avg_sessions_per_week.toFixed(1)}
        />
        <Row
          label={t("engagementDebug.avgDuration")}
          value={t("engagementDebug.minutes", {
            count: Math.round(profile.avg_session_duration_minutes),
          })}
        />
        <Row
          label={t("engagementDebug.lastTwoWeeks")}
          value={`${profile.sessions_last_7_days} / ${profile.sessions_previous_7_days}`}
        />
        <Row
          label={t("engagementDebug.daysSince")}
          value={
            profile.days_since_last_session === null
              ? none
              : String(profile.days_since_last_session)
          }
        />
        <Row
          label={t("engagementDebug.usualHours")}
          value={
            profile.preferred_hours.length
              ? profile.preferred_hours.map(formatHour).join(", ")
              : none
          }
        />
        <Row
          label={t("engagementDebug.window")}
          value={
            window.is_default
              ? t("engagementDebug.defaultWindow", { window: formatWindow(window) })
              : formatWindow(window)
          }
        />
      </View>
    </Section>
  );
}

function LastPushSection({ lastDelivery }: { lastDelivery: EngagementDebug["last_delivery"] }) {
  const { t } = useTranslation();
  return (
    <Section title={t("engagementDebug.lastPushTitle")}>
      <View style={styles.card}>
        {lastDelivery ? (
          <>
            <Row
              label={lastDelivery.notification_type}
              value={formatMoment(lastDelivery.sent_at)}
            />
            <Row label={t("engagementDebug.outcome")} value={lastDelivery.outcome} />
            {lastDelivery.candidate_score !== null ? (
              <Row
                label={t("engagementDebug.score")}
                value={String(lastDelivery.candidate_score)}
              />
            ) : null}
            {lastDelivery.reason ? <Text style={styles.muted}>{lastDelivery.reason}</Text> : null}
          </>
        ) : (
          <Text style={styles.muted}>{t("engagementDebug.noPush")}</Text>
        )}
      </View>
    </Section>
  );
}
