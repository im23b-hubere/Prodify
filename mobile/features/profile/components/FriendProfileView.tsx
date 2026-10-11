import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { BackButton } from "../../../components/ui/BackButton";
import { colors } from "../../../constants/theme";
import { StatsHeatmapSection } from "../../stats/components/StatsHeatmapSection";
import { translatedWeekday } from "../friendProfilePresentation";
import { friendProfileStyles as styles } from "../friendProfile.styles";
import type { FriendProfileState } from "../hooks/useFriendProfile";
import {
  AchievementsRow,
  CommitmentCard,
  FocusCard,
  FriendStatsGrid,
  RecentSessionsCard,
} from "./FriendProfileCards";
import { FriendProfileHero } from "./FriendProfileHero";
import { FriendProfileSkeleton, LockedProfile } from "./FriendProfileStates";
import { HeadToHeadCard } from "./HeadToHeadCard";

/** Scroll distance over which the username fades into the top bar, roughly when the hero name leaves. */
const TITLE_FADE_RANGE = [150, 200];
const SECTION_STAGGER_MS = 60;
const AMBIENT_GLOW = ["rgba(255,61,0,0.18)", "rgba(255,61,0,0.05)", "rgba(10,10,10,0)"] as const;

type Props = {
  state: FriendProfileState;
  isSendingRequest: boolean;
  onBack: () => void;
  onOpenFriends: () => void;
  onOpenSession: (id: number, ownerName: string) => void;
  onChallenge: (friendId: number) => void;
  onSendRequest: (username: string) => void;
};

type VisibleData = NonNullable<FriendProfileState["visible"]>;

export function FriendProfileView(props: Props) {
  const { state, onBack } = props;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
  });
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), TITLE_FADE_RANGE, [0, 1], Extrapolation.CLAMP),
  }));
  const title = state.visible?.profile.username ?? state.targetUsername ?? "";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="friend-profile-screen">
      <LinearGradient
        pointerEvents="none"
        colors={AMBIENT_GLOW}
        locations={[0, 0.42, 1]}
        style={styles.ambient}
      />
      <View style={styles.topBar}>
        <View style={styles.topBarSide}>
          <BackButton onPress={onBack} />
        </View>
        <Animated.Text
          style={[styles.topBarTitle, titleStyle]}
          numberOfLines={1}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {title}
        </Animated.Text>
        <View style={styles.topBarSide} />
      </View>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
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
        <ProfileBody {...props} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function ProfileBody({
  state,
  isSendingRequest,
  onBack,
  onOpenFriends,
  onOpenSession,
  onChallenge,
  onSendRequest,
}: Props) {
  const { t } = useTranslation();
  if (state.loadState === "loading" && !state.refreshing) {
    return (
      <FriendProfileSkeleton
        label={t(state.isOwnProfile ? "friendProfile.loadingOwnProfile" : "friendProfile.loadingProfile")}
      />
    );
  }
  if (state.loadState === "error") {
    return (
      <View style={styles.centered}>
        <ErrorState
          title={t("friendProfile.couldNotLoadTitle")}
          message={state.error ?? t("friendProfile.loadError")}
          retryLabel={t("friendProfile.retry")}
          onRetry={() => void state.load()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendProfile.backA11y")}
          style={styles.textAction}
          onPress={onBack}
        >
          <Text style={styles.textActionLabel}>{t("friendProfile.back")}</Text>
        </Pressable>
      </View>
    );
  }
  if (state.status === "none" || state.status === "pending") {
    return (
      <LockedProfile
        username={state.targetUsername}
        isPending={state.status === "pending"}
        pendingDirection={state.pendingDirection}
        isSending={isSendingRequest}
        onSendRequest={onSendRequest}
        onOpenFriends={onOpenFriends}
      />
    );
  }
  if (!state.visible) return null;
  return (
    <VisibleProfile
      visible={state.visible}
      isOwnProfile={state.status === "self"}
      onOpenSession={onOpenSession}
      onChallenge={onChallenge}
    />
  );
}

function StaggeredSection({ order, children }: { order: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(order * SECTION_STAGGER_MS)}>
      {children}
    </Animated.View>
  );
}

function VisibleProfile({
  visible,
  isOwnProfile,
  onOpenSession,
  onChallenge,
}: {
  visible: VisibleData;
  isOwnProfile: boolean;
  onOpenSession: Props["onOpenSession"];
  onChallenge: Props["onChallenge"];
}) {
  const { t } = useTranslation();
  const { profile, stats, sessions, commitment, yourStats, isBuddy } = visible;
  const showHeadToHead = !isOwnProfile && yourStats != null;
  return (
    <>
      <StaggeredSection order={0}>
        <FriendProfileHero
          profile={profile}
          isOwnProfile={isOwnProfile}
          isBuddy={isBuddy}
          onChallenge={() => onChallenge(profile.id)}
        />
      </StaggeredSection>
      {showHeadToHead ? (
        <StaggeredSection order={1}>
          <HeadToHeadCard you={yourStats} them={stats} friendName={profile.username} t={t} />
        </StaggeredSection>
      ) : null}
      <StaggeredSection order={2}>
        <FriendStatsGrid profile={profile} stats={stats} showTotals={!showHeadToHead} t={t} />
      </StaggeredSection>
      {commitment ? (
        <StaggeredSection order={3}>
          <CommitmentCard commitment={commitment} t={t} />
        </StaggeredSection>
      ) : null}
      <StaggeredSection order={4}>
        <StatsHeatmapSection t={t} days={stats.heatmap_days} />
      </StaggeredSection>
      <StaggeredSection order={5}>
        <FocusCard
          breakdown={stats.type_breakdown}
          bestDayLabel={translatedWeekday(stats.best_day, t)}
          t={t}
        />
      </StaggeredSection>
      <StaggeredSection order={6}>
        <AchievementsRow stats={stats} t={t} />
      </StaggeredSection>
      <StaggeredSection order={7}>
        <RecentSessionsCard
          sessions={sessions}
          ownerName={profile.username}
          onOpenSession={onOpenSession}
          t={t}
        />
      </StaggeredSection>
    </>
  );
}
