import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityHeatmapCard } from "../../../components/profile/ActivityHeatmapCard";
import { ProfileHeader } from "../../../components/profile/ProfileHeader";
import { StreakComparison } from "../../../components/profile/StreakComparison";
import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import { profilePictureUrl, translatedWeekday } from "../friendProfilePresentation";
import { friendProfileStyles as styles } from "../friendProfile.styles";
import type { FriendProfileState } from "../hooks/useFriendProfile";
import {
  AchievementsCard,
  OverviewCard,
  RecentSessionsCard,
  ReliabilityCard,
  SharedMomentumCard,
} from "./FriendProfileCards";

type Props = {
  state: FriendProfileState;
  onBack: () => void;
  onOpenFriends: () => void;
  onOpenSession: (id: number, ownerName: string) => void;
};

export function FriendProfileView({ state, onBack, onOpenFriends, onOpenSession }: Props) {
  const { t } = useTranslation();
  if (state.loadState === "loading" && !state.refreshing) {
    return (
      <ProfileShell onBack={onBack}>
        <LoadingState
          message={t(
            state.isOwnProfile ? "friendProfile.loadingOwnProfile" : "friendProfile.loadingProfile",
          )}
        />
      </ProfileShell>
    );
  }
  if (state.loadState === "error") {
    return (
      <ProfileShell onBack={onBack}>
        <ErrorState
          title={t("friendProfile.couldNotLoadTitle")}
          message={state.error ?? t("friendProfile.loadError")}
          retryLabel={t("friendProfile.retry")}
          onRetry={() => void state.load()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendProfile.backA11y")}
          style={styles.bootBackBtn}
          onPress={onBack}
        >
          <Text style={styles.bootBackTxt}>{t("friendProfile.back")}</Text>
        </Pressable>
      </ProfileShell>
    );
  }
  return (
    <ReadyProfile
      state={state}
      onBack={onBack}
      onOpenFriends={onOpenFriends}
      onOpenSession={onOpenSession}
    />
  );
}

function ProfileBackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("friendProfile.backA11y")}
      onPress={onPress}
      hitSlop={12}
    >
      <Text style={styles.back}>{t("friendProfile.backArrow")}</Text>
    </Pressable>
  );
}

function ProfileShell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <ProfileBackButton onPress={onBack} />
      </View>
      <View style={styles.bootWrap}>{children}</View>
    </SafeAreaView>
  );
}

function ReadyProfile({ state, onBack, onOpenFriends, onOpenSession }: Props) {
  const locked = state.status === "none" || state.status === "pending";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <ProfileBackButton onPress={onBack} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={state.refresh}
            tintColor={colors.primary}
          />
        }
      >
        {locked ? <LockedProfile state={state} onOpenFriends={onOpenFriends} /> : null}
        {!locked && state.profile && state.stats ? (
          <VisibleProfile state={state} onOpenSession={onOpenSession} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LockedProfile({
  state,
  onOpenFriends,
}: {
  state: FriendProfileState;
  onOpenFriends: () => void;
}) {
  const { t } = useTranslation();
  const message =
    state.status === "pending"
      ? t(
          state.pendingDirection === "incoming"
            ? "friendProfile.lockedPendingIncoming"
            : "friendProfile.lockedPendingOutgoing",
        )
      : t("friendProfile.lockedNone");
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedMainTitle}>
        {state.targetUsername
          ? t("friendProfile.lockedUserHeading", { name: state.targetUsername })
          : t("friendProfile.lockedTitle")}
      </Text>
      <Text style={styles.lockedSub}>{message}</Text>
      <PrimaryButton label={t("friendProfile.friendsTab")} onPress={onOpenFriends} />
    </View>
  );
}

function VisibleProfile({
  state,
  onOpenSession,
}: {
  state: FriendProfileState;
  onOpenSession: Props["onOpenSession"];
}) {
  const { t } = useTranslation();
  const { profile, stats } = state;
  if (!profile || !stats) return null;
  return (
    <>
      <ProfileHeader
        username={profile.username}
        totalSessions={profile.total_sessions}
        currentStreak={profile.current_streak}
        friendsCount={profile.friends_count}
        status={state.status === "self" ? "self" : "accepted"}
        identityTags={profile.identity_tags ?? []}
        streakStatusLabel={profile.streak_status_label}
        streakStatusEmoji={profile.streak_status_emoji}
        profilePictureUrl={profilePictureUrl(profile.profile_picture_url)}
      />
      {state.status !== "self" ? (
        <View style={styles.block}>
          <StreakComparison yourStreak={state.yourStreak} theirStreak={stats.current_streak} />
        </View>
      ) : null}
      <ReliabilityCard profile={profile} t={t} />
      <OverviewCard
        profile={profile}
        stats={stats}
        bestDayLabel={translatedWeekday(stats.best_day, t)}
        buddyStatus={state.buddyStatus}
        t={t}
      />
      <SharedMomentumCard
        isOwnProfile={state.status === "self"}
        yourStreak={state.yourStreak}
        theirStreak={stats.current_streak}
        socialRecap={state.socialRecap}
        t={t}
      />
      <View style={styles.block}>
        <ActivityHeatmapCard days={stats.heatmap_days} />
      </View>
      <AchievementsCard stats={stats} t={t} />
      <RecentSessionsCard
        sessions={state.sessions}
        ownerName={profile.username}
        onOpenSession={onOpenSession}
        t={t}
      />
    </>
  );
}
