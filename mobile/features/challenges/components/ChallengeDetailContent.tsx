import { Swords, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { AppCard } from "../../../components/ui/AppCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../../components/ui/SecondaryButton";
import { colors } from "../../../constants/theme";
import { challengeKindLabel } from "../../friends/utils/friendsScreenFormat";
import { challengeDetailStyles as styles } from "../challengeDetail.styles";
import { challengeStatusLabel, memberProgressPercent } from "../challengeDetailPresentation";
import type { ChallengeDetailController } from "../hooks/useChallengeDetail";

type Props = {
  detail: ChallengeDetailController;
  currentUserId: number | undefined;
};

export function ChallengeDetailContent({ detail, currentUserId }: Props) {
  const challenge = detail.challenge;
  if (!challenge) return null;
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={detail.refreshing}
          onRefresh={() => void detail.load({ silent: true })}
          tintColor={colors.primary}
        />
      }
    >
      <ChallengeHero detail={detail} />
      <ChallengeStats detail={detail} />
      <ChallengeLeader detail={detail} currentUserId={currentUserId} />
      <ChallengeLeaderboard detail={detail} currentUserId={currentUserId} />
      <ChallengeActions detail={detail} />
    </ScrollView>
  );
}

function ChallengeHero({ detail }: Pick<Props, "detail">) {
  const { t } = useTranslation();
  const challenge = detail.challenge;
  if (!challenge) return null;
  return (
    <AppCard style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}>
          <Swords color={colors.primary} size={22} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <View style={styles.pillRow}>
            <View style={styles.kindPill}>
              <Text style={styles.kindPillText}>
                {challengeKindLabel(challenge.challenge_kind, t)}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                challenge.status === "active" && styles.statusPillActive,
                challenge.status === "completed" && styles.statusPillDone,
              ]}
            >
              <Text style={styles.statusPillText}>{challengeStatusLabel(challenge, t)}</Text>
            </View>
          </View>
        </View>
      </View>
      {detail.outcomeLine ? (
        <View style={styles.outcomeRow}>
          <Trophy color={colors.primary} size={16} />
          <Text style={styles.outcomeText}>{detail.outcomeLine}</Text>
        </View>
      ) : (
        <Text style={styles.heroSub}>
          {t("friendsScreen.challengeActiveLine", {
            target: challenge.target_sessions,
            days: detail.daysLeft,
            rank: challenge.your_rank ?? "—",
          })}
        </Text>
      )}
    </AppCard>
  );
}

function ChallengeStats({ detail }: Pick<Props, "detail">) {
  const { t } = useTranslation();
  const challenge = detail.challenge;
  if (!challenge) return null;
  const stats = [
    [challenge.target_sessions, t("challengeDetail.statTarget")],
    [detail.daysLeft, t("challengeDetail.statDaysLeft")],
    [challenge.your_rank ?? "—", t("challengeDetail.statYourRank")],
    [detail.totalSessions, t("challengeDetail.statTotalSessions")],
  ];
  return (
    <>
      <Text style={styles.sectionLabel}>{t("challengeDetail.statsTitle")}</Text>
      <View style={styles.statsGrid}>
        {stats.map(([value, label]) => (
          <AppCard key={label} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </AppCard>
        ))}
      </View>
    </>
  );
}

function ChallengeLeader({ detail, currentUserId }: Props) {
  const { t } = useTranslation();
  const challenge = detail.challenge;
  if (!challenge || !detail.leaderMember || !detail.isActive) return null;
  const leaderName =
    detail.leaderMember.user_id === currentUserId
      ? t("challengeDetail.leaderYou")
      : detail.leaderMember.username;
  return (
    <AppCard style={styles.leaderCard}>
      <Text style={styles.leaderLabel}>{t("challengeDetail.currentLeader")}</Text>
      <Text style={styles.leaderName}>{leaderName}</Text>
      <Text style={styles.leaderMeta}>
        {t("challengeDetail.leaderSessions", {
          count: detail.leaderMember.progress_sessions,
          target: challenge.target_sessions,
        })}
      </Text>
    </AppCard>
  );
}

function ChallengeLeaderboard({ detail, currentUserId }: Props) {
  const { t } = useTranslation();
  const challenge = detail.challenge;
  if (!challenge) return null;
  return (
    <>
      <Text style={styles.sectionLabel}>{t("challengeDetail.leaderboardTitle")}</Text>
      <AppCard style={styles.leaderboardCard}>
        {challenge.members.map((member, index) => {
          const pct = memberProgressPercent(member.progress_sessions, challenge.target_sessions);
          const isCurrentUser = member.user_id === currentUserId;
          const isLeader = detail.leaderMember?.user_id === member.user_id && detail.isActive;
          return (
            <View
              key={member.user_id}
              style={[styles.memberRow, index > 0 && styles.memberRowBorder]}
            >
              <View style={styles.memberHeader}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberRank}>#{index + 1}</Text>
                  <Text style={[styles.memberName, isCurrentUser && styles.memberNameMe]}>
                    {member.username}
                    {isCurrentUser ? ` ${t("challengeDetail.youSuffix")}` : ""}
                  </Text>
                  {isLeader ? (
                    <View style={styles.leaderBadge}>
                      <Text style={styles.leaderBadgeText}>{t("challengeDetail.leaderBadge")}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.memberScore, isCurrentUser && styles.memberNameMe]}>
                  {member.progress_sessions}/{challenge.target_sessions}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.memberPct}>{t("challengeDetail.progressPct", { pct })}</Text>
            </View>
          );
        })}
      </AppCard>
    </>
  );
}

function ChallengeActions({ detail }: Pick<Props, "detail">) {
  const { t } = useTranslation();
  return (
    <View style={styles.actions}>
      {!detail.isMember && detail.isActive ? (
        <PrimaryButton
          label={
            detail.busyActionKey === "join"
              ? t("friendsScreen.loading")
              : t("friendsScreen.joinThisChallenge")
          }
          onPress={() => void detail.join()}
          disabled={detail.busyActionKey === "join"}
        />
      ) : null}
      {detail.isActive && detail.isOwner ? <OwnerActions detail={detail} /> : null}
      {detail.isActive && detail.isMember && !detail.isOwner ? (
        <SecondaryButton
          label={
            detail.busyActionKey === "leave"
              ? t("friendsScreen.loading")
              : t("friendsScreen.challengeLeave")
          }
          onPress={detail.confirmLeave}
          disabled={detail.busyActionKey === "leave"}
        />
      ) : null}
    </View>
  );
}

function OwnerActions({ detail }: Pick<Props, "detail">) {
  const { t } = useTranslation();
  return (
    <View style={styles.actionRow}>
      <View style={styles.actionHalf}>
        <SecondaryButton
          label={t("friendsScreen.challengeEdit")}
          onPress={detail.openEdit}
          disabled={detail.busyActionKey != null}
        />
      </View>
      <View style={styles.actionHalf}>
        <SecondaryButton
          label={
            detail.busyActionKey === "cancel"
              ? t("friendsScreen.loading")
              : t("friendsScreen.challengeEnd")
          }
          onPress={detail.confirmCancel}
          disabled={detail.busyActionKey === "cancel"}
        />
      </View>
    </View>
  );
}
