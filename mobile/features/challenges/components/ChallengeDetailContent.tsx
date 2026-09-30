import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { AppCard } from "../../../components/ui/AppCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../../components/ui/SecondaryButton";
import { colors } from "../../../constants/theme";
import { DuelScoreboard } from "./DuelScoreboard";
import { challengeDetailStyles as styles } from "../challengeDetail.styles";
import { duelParticipants } from "../duelParticipants";
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
      <ChallengeHero detail={detail} currentUserId={currentUserId} />
      <ChallengeRoster detail={detail} currentUserId={currentUserId} />
      <ChallengeActions detail={detail} />
    </ScrollView>
  );
}

function ChallengeHero({ detail, currentUserId }: Props) {
  const { t } = useTranslation();
  const challenge = detail.challenge;
  if (!challenge) return null;
  const { you, opponent } = duelParticipants(challenge, currentUserId);
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroTitle}>{challenge.title}</Text>
      <DuelScoreboard
        t={t}
        leftLabel={t("friendsScreen.buddyDuelYouLabel")}
        leftScore={you?.progress_sessions ?? 0}
        rightLabel={opponent?.username ?? t("friendsScreen.challengeSomeone")}
        rightScore={opponent?.progress_sessions ?? 0}
        meta={
          detail.outcomeLine ??
          t("friendsScreen.challengeDaysLeftShort", { count: detail.daysLeft })
        }
      />
    </View>
  );
}

function ChallengeRoster({ detail, currentUserId }: Props) {
  const { t } = useTranslation();
  const challenge = detail.challenge;
  if (!challenge || challenge.members.length < 3) return null;
  const ranked = [...challenge.members].sort(
    (left, right) => right.progress_sessions - left.progress_sessions,
  );
  return (
    <AppCard style={styles.leaderboardCard}>
      {ranked.map((member, index) => {
        const isCurrentUser = member.user_id === currentUserId;
        return (
          <View
            key={member.user_id}
            style={[styles.memberRow, styles.memberHeader, index > 0 && styles.memberRowBorder]}
          >
            <Text style={[styles.memberName, isCurrentUser && styles.memberNameMe]}>
              {member.username}
              {isCurrentUser ? ` ${t("challengeDetail.youSuffix")}` : ""}
            </Text>
            <Text style={[styles.memberScore, isCurrentUser && styles.memberNameMe]}>
              {member.progress_sessions}
            </Text>
          </View>
        );
      })}
    </AppCard>
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
