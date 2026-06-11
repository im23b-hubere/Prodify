import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Swords, Trophy } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppCard } from "../../components/ui/AppCard";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { challengeDaysLeft, challengeKindLabel } from "../../features/friends/utils/friendsScreenFormat";
import {
  cancelChallenge,
  fetchChallenge,
  joinSocialChallenge,
  leaveChallenge,
  updateChallenge,
} from "../../lib/social";
import type { SocialChallengeDto } from "../../types/friends";

function parseChallengeId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function statusLabel(
  challenge: SocialChallengeDto,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (challenge.status === "completed") {
    if (challenge.is_tie) return t("challengeDetail.statusTie");
    return t("challengeDetail.statusCompleted");
  }
  if (challenge.status === "cancelled") return t("challengeDetail.statusCancelled");
  return t("challengeDetail.statusActive");
}

export default function ChallengeDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const challengeId = parseChallengeId(params.id);

  const [challenge, setChallenge] = useState<SocialChallengeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTarget, setEditTarget] = useState("5");
  const [editDuration, setEditDuration] = useState("7");
  const [editBusy, setEditBusy] = useState(false);

  const currentUserId = user?.id;
  const isMember = useMemo(
    () =>
      typeof currentUserId === "number" &&
      (challenge?.members.some((m) => m.user_id === currentUserId) ?? false),
    [challenge?.members, currentUserId],
  );
  const isOwner = challenge?.owner_id === currentUserId;
  const isActive = challenge?.status === "active";

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || challengeId == null) {
        setChallenge(null);
        setError(challengeId == null ? t("challengeDetail.invalidChallenge") : null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const silent = opts?.silent ?? false;
      setError(null);
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const row = await fetchChallenge(token, challengeId);
        setChallenge(row);
      } catch (e) {
        setChallenge(null);
        setError(e instanceof Error ? e.message : t("challengeDetail.loadError"));
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [challengeId, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const daysLeft =
    challenge?.days_remaining ??
    (challenge
      ? challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
        challenge.duration_days ??
        7
      : 0);

  const leaderMember = useMemo(() => {
    if (!challenge?.members.length) return null;
    const top = Math.max(...challenge.members.map((m) => m.progress_sessions));
    const leaders = challenge.members.filter((m) => m.progress_sessions === top);
    return leaders.length === 1 ? leaders[0] : null;
  }, [challenge?.members]);

  const totalSessions = useMemo(
    () => challenge?.members.reduce((sum, m) => sum + m.progress_sessions, 0) ?? 0,
    [challenge?.members],
  );

  const openEdit = useCallback(() => {
    if (!challenge) return;
    setEditTitle(challenge.title);
    setEditTarget(String(challenge.target_sessions));
    setEditDuration(String(challenge.duration_days ?? 7));
    setEditOpen(true);
  }, [challenge]);

  const submitEdit = useCallback(async () => {
    if (!token || challengeId == null) return;
    const title = editTitle.trim();
    const target = Number.parseInt(editTarget, 10);
    const durationDays = Number.parseInt(editDuration, 10);
    if (
      title.length < 3 ||
      !Number.isFinite(target) ||
      target < 1 ||
      !Number.isFinite(durationDays) ||
      durationDays < 3
    ) {
      Alert.alert(t("friendsScreen.invalidChallengeTitle"), t("friendsScreen.invalidChallengeBody"));
      return;
    }
    setEditBusy(true);
    try {
      const updated = await updateChallenge(token, challengeId, {
        title,
        target_sessions: target,
        duration_days: durationDays,
      });
      setChallenge(updated);
      setEditOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      Alert.alert(t("friendsScreen.couldNotUpdateChallenge"), msg);
    } finally {
      setEditBusy(false);
    }
  }, [challengeId, editDuration, editTarget, editTitle, t, token]);

  const confirmCancel = useCallback(() => {
    if (!token || challengeId == null) return;
    Alert.alert(t("friendsScreen.challengeEndTitle"), t("friendsScreen.challengeEndBody"), [
      { text: t("friendsScreen.modalCancel"), style: "cancel" },
      {
        text: t("friendsScreen.challengeEndConfirm"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusyActionKey("cancel");
            try {
              await cancelChallenge(token, challengeId);
              router.back();
            } catch (e) {
              const msg = e instanceof Error ? e.message : t("common.tryAgain");
              Alert.alert(t("friendsScreen.couldNotEndChallenge"), msg);
            } finally {
              setBusyActionKey(null);
            }
          })();
        },
      },
    ]);
  }, [challengeId, router, t, token]);

  const confirmLeave = useCallback(() => {
    if (!token || challengeId == null) return;
    Alert.alert(t("friendsScreen.challengeLeaveTitle"), t("friendsScreen.challengeLeaveBody"), [
      { text: t("friendsScreen.modalCancel"), style: "cancel" },
      {
        text: t("friendsScreen.challengeLeaveConfirm"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusyActionKey("leave");
            try {
              await leaveChallenge(token, challengeId);
              router.back();
            } catch (e) {
              const msg = e instanceof Error ? e.message : t("common.tryAgain");
              Alert.alert(t("friendsScreen.couldNotLeaveChallenge"), msg);
            } finally {
              setBusyActionKey(null);
            }
          })();
        },
      },
    ]);
  }, [challengeId, router, t, token]);

  const joinChallenge = useCallback(async () => {
    if (!token || challengeId == null) return;
    setBusyActionKey("join");
    try {
      const updated = await joinSocialChallenge(token, challengeId);
      setChallenge(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.tryAgain");
      Alert.alert(t("friendsScreen.errorGeneric"), msg);
    } finally {
      setBusyActionKey(null);
    }
  }, [challengeId, t, token]);

  const outcomeLine = useMemo(() => {
    if (!challenge || challenge.status !== "completed") return null;
    if (challenge.is_tie) return t("friendsScreen.challengeEndedTie");
    if (challenge.winner_user_id === currentUserId) return t("friendsScreen.challengeYouWon");
    const winner =
      challenge.members.find((m) => m.user_id === challenge.winner_user_id)?.username ??
      t("friendsScreen.challengeSomeone");
    return t("friendsScreen.challengeEndedWinner", { winner });
  }, [challenge, currentUserId, t]);

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
                    <Text style={styles.statusPillText}>{statusLabel(challenge, t)}</Text>
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
              const pct = Math.max(
                0,
                Math.min(
                  100,
                  Math.round((member.progress_sessions / challenge.target_sessions) * 100),
                ),
              );
              const me = member.user_id === currentUserId;
              const isLeader =
                leaderMember != null && member.user_id === leaderMember.user_id;
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
                          <Text style={styles.leaderBadgeText}>{t("challengeDetail.leaderBadge")}</Text>
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
                onPress={() => void joinChallenge()}
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

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditOpen(false)}>
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
            <Pressable style={styles.modalCancel} onPress={() => setEditOpen(false)}>
              <Text style={styles.modalCancelText}>{t("friendsScreen.modalCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backSpacer: { width: 40 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.sectionTitle,
  },
  pressed: { opacity: 0.88 },
  centerState: {
    flex: 1,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroCard: { gap: spacing.sm },
  heroTop: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, gap: spacing.xs },
  heroTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.cardTitle,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  kindPill: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindPillText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
  statusPill: {
    borderRadius: radii.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillActive: {
    borderColor: "rgba(99, 102, 241, 0.45)",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  statusPillDone: {
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  statusPillText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
  },
  heroSub: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  outcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  outcomeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
    flex: 1,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 28,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
    textAlign: "center",
  },
  leaderCard: { gap: 4 },
  leaderLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  leaderName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.cardTitle,
  },
  leaderMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  leaderboardCard: { gap: 0, paddingVertical: spacing.xs },
  memberRow: { paddingVertical: spacing.sm, gap: 6 },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  memberNameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  memberRank: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    minWidth: 22,
  },
  memberName: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.bodyStrong,
  },
  memberNameMe: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  leaderBadge: {
    borderRadius: radii.round,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  leaderBadgeText: {
    color: "#fbbf24",
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  memberScore: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  memberPct: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionHalf: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.sectionTitle,
  },
  modalHint: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.meta,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
    marginTop: spacing.xs,
  },
  input: {
    minHeight: ui.buttonHeight,
    borderRadius: ui.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
  },
  modalCancel: { alignItems: "center", paddingVertical: spacing.sm },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.bodyStrong,
  },
});
