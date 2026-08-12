import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Swords, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../../components/ui/AppCard";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { colors } from "../../constants/theme";
import { challengeDetailStyles as styles } from "../../features/challenges/challengeDetail.styles";
import { useAuth } from "../../context/AuthContext";
import { challengeKindLabel } from "../../features/friends/utils/friendsScreenFormat";
import {
  challengeStatusLabel,
  memberProgressPercent,
  parseChallengeId,
} from "../../features/challenges/challengeDetailPresentation";
import { useChallengeDetail } from "../../features/challenges/hooks/useChallengeDetail";

export default function ChallengeDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const challengeId = parseChallengeId(params.id);

  const currentUserId = user?.id;
  const {
    challenge,
    loading,
    refreshing,
    error,
    busyActionKey,
    load,
    join,
    confirmCancel,
    confirmLeave,
    isMember,
    isOwner,
    isActive,
    daysLeft,
    leaderMember,
    totalSessions,
    outcomeLine,
    editOpen,
    closeEdit,
    openEdit,
    editTitle,
    setEditTitle,
    editTarget,
    setEditTarget,
    editDuration,
    setEditDuration,
    editBusy,
    submitEdit,
  } = useChallengeDetail(token, challengeId, currentUserId);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("challengeDetail.backA11y")}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <Text style={styles.topTitle}>{t("challengeDetail.title")}</Text>
        <View style={styles.backSpacer} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerState}>
          <LoadingState message={t("challengeDetail.loading")} />
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.centerState}>
          <ErrorState
            title={t("challengeDetail.loadErrorTitle")}
            message={error}
            onRetry={() => void load()}
            retryLabel={t("challengeDetail.retry")}
          />
        </View>
      ) : null}

      {!loading && !error && challenge ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load({ silent: true })}
              tintColor={colors.primary}
            />
          }
        >
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
            {outcomeLine ? (
              <View style={styles.outcomeRow}>
                <Trophy color={colors.primary} size={16} />
                <Text style={styles.outcomeText}>{outcomeLine}</Text>
              </View>
            ) : (
              <Text style={styles.heroSub}>
                {t("friendsScreen.challengeActiveLine", {
                  target: challenge.target_sessions,
                  days: daysLeft,
                  rank: challenge.your_rank ?? "—",
                })}
              </Text>
            )}
          </AppCard>

          <Text style={styles.sectionLabel}>{t("challengeDetail.statsTitle")}</Text>
          <View style={styles.statsGrid}>
            <AppCard style={styles.statCard}>
              <Text style={styles.statValue}>{challenge.target_sessions}</Text>
              <Text style={styles.statLabel}>{t("challengeDetail.statTarget")}</Text>
            </AppCard>
            <AppCard style={styles.statCard}>
              <Text style={styles.statValue}>{daysLeft}</Text>
              <Text style={styles.statLabel}>{t("challengeDetail.statDaysLeft")}</Text>
            </AppCard>
            <AppCard style={styles.statCard}>
              <Text style={styles.statValue}>{challenge.your_rank ?? "—"}</Text>
              <Text style={styles.statLabel}>{t("challengeDetail.statYourRank")}</Text>
            </AppCard>
            <AppCard style={styles.statCard}>
              <Text style={styles.statValue}>{totalSessions}</Text>
              <Text style={styles.statLabel}>{t("challengeDetail.statTotalSessions")}</Text>
            </AppCard>
          </View>

          {leaderMember && isActive ? (
            <AppCard style={styles.leaderCard}>
              <Text style={styles.leaderLabel}>{t("challengeDetail.currentLeader")}</Text>
              <Text style={styles.leaderName}>
                {leaderMember.user_id === currentUserId
                  ? t("challengeDetail.leaderYou")
                  : leaderMember.username}
              </Text>
              <Text style={styles.leaderMeta}>
                {t("challengeDetail.leaderSessions", {
                  count: leaderMember.progress_sessions,
                  target: challenge.target_sessions,
                })}
              </Text>
            </AppCard>
          ) : null}

          <Text style={styles.sectionLabel}>{t("challengeDetail.leaderboardTitle")}</Text>
          <AppCard style={styles.leaderboardCard}>
            {challenge.members.map((member, index) => {
              const pct = memberProgressPercent(
                member.progress_sessions,
                challenge.target_sessions,
              );
              const me = member.user_id === currentUserId;
              const isLeader = leaderMember != null && member.user_id === leaderMember.user_id;
              return (
                <View
                  key={member.user_id}
                  style={[styles.memberRow, index > 0 && styles.memberRowBorder]}
                >
                  <View style={styles.memberHeader}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberRank}>#{index + 1}</Text>
                      <Text style={[styles.memberName, me && styles.memberNameMe]}>
                        {member.username}
                        {me ? ` ${t("challengeDetail.youSuffix")}` : ""}
                      </Text>
                      {isLeader && isActive ? (
                        <View style={styles.leaderBadge}>
                          <Text style={styles.leaderBadgeText}>
                            {t("challengeDetail.leaderBadge")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.memberScore, me && styles.memberNameMe]}>
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

          <View style={styles.actions}>
            {!isMember && isActive ? (
              <PrimaryButton
                label={
                  busyActionKey === "join"
                    ? t("friendsScreen.loading")
                    : t("friendsScreen.joinThisChallenge")
                }
                onPress={() => void join()}
                disabled={busyActionKey === "join"}
              />
            ) : null}
            {isActive && isOwner ? (
              <View style={styles.actionRow}>
                <View style={styles.actionHalf}>
                  <SecondaryButton
                    label={t("friendsScreen.challengeEdit")}
                    onPress={openEdit}
                    disabled={busyActionKey != null}
                  />
                </View>
                <View style={styles.actionHalf}>
                  <SecondaryButton
                    label={
                      busyActionKey === "cancel"
                        ? t("friendsScreen.loading")
                        : t("friendsScreen.challengeEnd")
                    }
                    onPress={confirmCancel}
                    disabled={busyActionKey === "cancel"}
                  />
                </View>
              </View>
            ) : null}
            {isActive && isMember && !isOwner ? (
              <SecondaryButton
                label={
                  busyActionKey === "leave"
                    ? t("friendsScreen.loading")
                    : t("friendsScreen.challengeLeave")
                }
                onPress={confirmLeave}
                disabled={busyActionKey === "leave"}
              />
            ) : null}
          </View>
        </ScrollView>
      ) : null}

      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        onRequestClose={() => closeEdit()}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => closeEdit()}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("friendsScreen.editChallengeTitle")}</Text>
            <Text style={styles.modalHint}>{t("friendsScreen.editChallengeHint")}</Text>
            <Text style={styles.fieldLabel}>{t("friendsScreen.challengeTitleLabel")}</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder={t("friendsScreen.challengeTitlePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>{t("friendsScreen.goalTargetLabel")}</Text>
            <TextInput
              value={editTarget}
              onChangeText={setEditTarget}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeTargetPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>{t("friendsScreen.goalDurationLabel")}</Text>
            <TextInput
              value={editDuration}
              onChangeText={setEditDuration}
              keyboardType="number-pad"
              placeholder={t("friendsScreen.challengeDurationPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <PrimaryButton
              label={editBusy ? t("friendsScreen.loading") : t("friendsScreen.saveChallenge")}
              onPress={() => void submitEdit()}
              disabled={editBusy}
            />
            <Pressable style={styles.modalCancel} onPress={() => closeEdit()}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
