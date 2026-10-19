import { LinearGradient } from "expo-linear-gradient";
import { Ellipsis } from "lucide-react-native";
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
import { useRankProgression } from "../../../hooks/useRankProgression";
import { PROGRESSION_NAMED_LEVEL_MAX } from "../../../lib/progressionLevels";
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
import { RankComparisonCard } from "./RankComparisonCard";

/** Scroll distance over which the username fades into the top bar, roughly when the hero name leaves. */
const TITLE_FADE_RANGE = [150, 200];
const SECTION_STAGGER_MS = 60;
const AMBIENT_GLOW = ["rgba(255,61,0,0.18)", "rgba(255,61,0,0.05)", "rgba(10,10,10,0)"] as const;

type Props = {
  state: FriendProfileState;
  isSendingRequest: boolean;
  isWithdrawingRequest: boolean;
  onBack: () => void;
  /** Report / block / unfriend menu; absent on your own profile. */
  onOpenMenu?: () => void;
  onOpenFriends: () => void;
  onOpenSession: (id: number, ownerName: string) => void;
  onChallenge: (friendId: number) => void;
  onSendRequest: (username: string) => void;
  onWithdrawRequest: () => void;
  onOpenRankPath?: () => void;
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
        <View style={[styles.topBarSide, styles.topBarSideEnd]}>
          {props.onOpenMenu ? <ProfileMenuButton name={title} onPress={props.onOpenMenu} /> : null}
        </View>
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
  isWithdrawingRequest,
  onBack,
  onOpenFriends,
  onOpenSession,
  onChallenge,
  onSendRequest,
  onWithdrawRequest,
  onOpenRankPath,
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
        isWithdrawing={isWithdrawingRequest}
        onSendRequest={onSendRequest}
        onWithdrawRequest={onWithdrawRequest}
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
      onOpenRankPath={onOpenRankPath}
    />
  );
}

function ProfileMenuButton({ name, onPress }: { name: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("safety.menu.profileA11y", { name })}
      hitSlop={10}
      style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
      onPress={onPress}
      testID="friend-profile-menu"
    >
      <Ellipsis color={colors.textPrimary} size={22} strokeWidth={2.2} />
    </Pressable>
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
  onOpenRankPath,
}: {
  visible: VisibleData;
  isOwnProfile: boolean;
  onOpenSession: Props["onOpenSession"];
  onChallenge: Props["onChallenge"];
  onOpenRankPath?: () => void;
}) {
  const { t } = useTranslation();
  const { profile, stats, sessions, commitment, yourStats, isBuddy } = visible;
  const showHeadToHead = !isOwnProfile && yourStats != null;
  const yourRank = useRankProgression(!isOwnProfile);
  const theirLevel = Math.min(
    PROGRESSION_NAMED_LEVEL_MAX,
    Math.max(1, Math.trunc(profile.level ?? 1)),
  );
  const yourLevel =
    yourRank.level == null
      ? null
      : Math.min(PROGRESSION_NAMED_LEVEL_MAX, Math.max(1, yourRank.level));
  const showRankCompare =
    !isOwnProfile && onOpenRankPath != null && yourRank.ready && yourLevel != null;
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
      {showRankCompare && yourLevel != null ? (
        <StaggeredSection order={showHeadToHead ? 2 : 1}>
          <RankComparisonCard
            you={{
              level: yourLevel,
              label: t("progression.xpHudLevelShort", { level: yourLevel }),
            }}
            them={{
              level: theirLevel,
              label: t("progression.xpHudLevelShort", { level: theirLevel }),
            }}
            friendName={profile.username}
            onOpenPath={onOpenRankPath}
          />
        </StaggeredSection>
      ) : null}
      <StaggeredSection order={3}>
        <FriendStatsGrid profile={profile} stats={stats} showTotals={!showHeadToHead} t={t} />
      </StaggeredSection>
      {commitment ? (
        <StaggeredSection order={4}>
          <CommitmentCard commitment={commitment} t={t} />
        </StaggeredSection>
      ) : null}
      <StaggeredSection order={5}>
        <StatsHeatmapSection t={t} days={stats.heatmap_days} />
      </StaggeredSection>
      <StaggeredSection order={6}>
        <FocusCard
          breakdown={stats.type_breakdown}
          bestDayLabel={translatedWeekday(stats.best_day, t)}
          t={t}
        />
      </StaggeredSection>
      <StaggeredSection order={7}>
        <AchievementsRow stats={stats} t={t} />
      </StaggeredSection>
      <StaggeredSection order={8}>
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
