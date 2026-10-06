import { BlurView } from "expo-blur";
import { Info } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { AppCard } from "../../../components/ui/AppCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ScreenTopBar } from "../../../components/ui/ScreenTopBar";
import { colors } from "../../../constants/theme";
import type { ProgressionOverviewState } from "../hooks/useProgressionOverview";
import { styles } from "../progressionOverview.styles";
import { buildRankPathLayout, rankPathCapColors } from "../rankPathLayout";
import { RankInfoModal } from "./RankInfoModal";
import { RankPath } from "./RankPath";

type Props = {
  overview: ProgressionOverviewState;
  signedIn: boolean;
  onBack: () => void;
  onSignIn: () => void;
};

/** Where the user's node lands in the viewport when the path scrolls to it. */
const CURRENT_NODE_VIEWPORT_RATIO = 0.55;
/** Pause on the summit before gliding down, so the goal registers first. */
const INTRO_SCROLL_DELAY_MS = 450;

export function ProgressionOverviewContent(props: Props) {
  const { t } = useTranslation();
  const { progression, loadError, loadingProgression } = props.overview;
  if (props.signedIn && !loadError && (progression || loadingProgression)) {
    return <ProgressionPathView {...props} />;
  }
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={progressionRefreshControl(props)}
      >
        <ScreenTopBar
          title={t("progression.overviewTitle")}
          subtitle={t("progression.overviewSubtitle")}
          onBack={props.onBack}
        />
        <ProgressionFeedback {...props} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressionPathView(props: Props) {
  const { t } = useTranslation();
  const { overview, onBack } = props;
  const progression = overview.progression;
  const pending = progression == null;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const layout = useMemo(() => buildRankPathLayout(width), [width]);
  const caps = useMemo(() => rankPathCapColors(layout), [layout]);
  const scrollRef = useRef<ScrollView>(null);
  const introDone = useRef(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);

  const pathLevel = pending
    ? null
    : Math.min(Math.max(1, progression.current_level), layout.nodes.length);
  const currentNodeY =
    pathLevel == null ? 0 : topBarHeight + (layout.nodes[pathLevel - 1]?.y ?? 0);

  const scrollToCurrent = useCallback(
    (animated: boolean) => {
      if (viewportHeight === 0 || pathLevel == null) return;
      scrollRef.current?.scrollTo({
        y: Math.max(0, currentNodeY - viewportHeight * CURRENT_NODE_VIEWPORT_RATIO),
        animated,
      });
    },
    [currentNodeY, pathLevel, viewportHeight],
  );

  useEffect(() => {
    if (pending || introDone.current || viewportHeight === 0 || topBarHeight === 0) return;
    const timer = setTimeout(
      () => {
        introDone.current = true;
        scrollToCurrent(!reduceMotion);
      },
      reduceMotion ? 0 : INTRO_SCROLL_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [pending, reduceMotion, scrollToCurrent, topBarHeight, viewportHeight]);

  return (
    <View
      style={styles.pathScreen}
      testID={pending ? "progression-overview-loading" : undefined}
      accessibilityState={pending ? { busy: true } : undefined}
    >
      {/* Over-scroll past either end shows the path's own cap colours instead of black. */}
      <View style={[styles.pathCap, styles.pathCapTop, { backgroundColor: caps.top }]} />
      <View style={[styles.pathCap, styles.pathCapBottom, { backgroundColor: caps.bottom }]} />
      <ScrollView
        ref={scrollRef}
        style={styles.pathScroll}
        contentContainerStyle={{ paddingTop: topBarHeight, paddingBottom: insets.bottom }}
        scrollIndicatorInsets={{ top: topBarHeight }}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        refreshControl={progressionRefreshControl(props, topBarHeight)}
      >
        <RankPath
          layout={layout}
          currentLevel={pathLevel}
          progressPercent={progression?.progress_percent ?? 0}
          xpTotal={progression?.xp_total ?? 0}
          xpToNext={progression?.xp_to_next_level ?? 0}
          levelCatalog={overview.levelCatalog}
          t={t}
        />
      </ScrollView>
      <BlurView
        intensity={40}
        tint="dark"
        style={[styles.pathTopBar, { paddingTop: insets.top + 4 }]}
        onLayout={(event) => setTopBarHeight(event.nativeEvent.layout.height)}
      >
        <ScreenTopBar
          title={t("progression.overviewTitle")}
          onBack={onBack}
          right={
            pending ? undefined : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("progression.info.open")}
                hitSlop={12}
                onPress={() => setInfoOpen(true)}
                style={({ pressed }) => [styles.infoButton, pressed && styles.infoButtonPressed]}
              >
                <Info color={colors.textPrimary} size={18} strokeWidth={2.4} />
              </Pressable>
            )
          }
        />
      </BlurView>
      <RankInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

function progressionRefreshControl(props: Props, progressViewOffset = 0) {
  if (!props.signedIn) return undefined;
  return (
    <RefreshControl
      progressViewOffset={progressViewOffset}
      refreshing={props.overview.refreshing}
      onRefresh={() => void props.overview.load({ silent: true, sync: true, force: true })}
      tintColor={colors.primary}
    />
  );
}

function ProgressionFeedback({ overview, signedIn, onSignIn }: Props) {
  const { t } = useTranslation();
  if (!signedIn) {
    return (
      <AppCard>
        <Text style={styles.levelTitle}>{t("progression.needSignInTitle")}</Text>
        <Text style={styles.metaLine}>{t("progression.needSignInBody")}</Text>
        <PrimaryButton label={t("progression.signInCta")} onPress={onSignIn} />
      </AppCard>
    );
  }
  if (overview.loadError) {
    return (
      <ErrorState
        title={t("common.oops")}
        message={overview.loadError}
        retryLabel={t("common.tryAgain")}
        onRetry={() => void overview.load({ force: true })}
      />
    );
  }
  return (
    <ErrorState
      title={t("common.oops")}
      message={t("progression.loadError")}
      retryLabel={t("common.tryAgain")}
      onRetry={() => void overview.load({ force: true })}
    />
  );
}
