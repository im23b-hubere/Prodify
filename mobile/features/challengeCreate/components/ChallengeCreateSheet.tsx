import type { TFunction } from "i18next";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { Easing, FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/states/ErrorState";
import { LoadingState } from "../../../components/states/LoadingState";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { CHALLENGE_STEPS, type ChallengeDraftIssue } from "../challengeDraft";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";
import type { ChallengeCreateScreen } from "../hooks/useChallengeCreateScreen";
import { ChallengeSentView } from "./ChallengeSentView";
import { ChallengeSheetHeader } from "./ChallengeSheetHeader";
import { FriendStep } from "./FriendStep";
import { GoalStep } from "./GoalStep";
import { ReviewStep } from "./ReviewStep";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_FORWARD = FadeInRight.duration(220).easing(EASE_OUT);
const ENTER_BACKWARD = FadeInLeft.duration(220).easing(EASE_OUT);

export function ChallengeCreateSheet({ screen }: { screen: ChallengeCreateScreen }) {
  const { t, data, draft, submitState } = screen;
  const insets = useSafeAreaInsets();

  if (submitState.status === "sent") {
    return (
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <ChallengeSentView
          t={t}
          friendName={draft.selectedFriend?.username ?? ""}
          onDone={screen.close}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      testID="challenge-create-sheet"
    >
      <ChallengeSheetHeader
        t={t}
        step={draft.draft.step}
        onBack={draft.draft.step === CHALLENGE_STEPS[0] ? null : screen.goBack}
        onClose={screen.close}
      />
      {data.loadState === "loading" ? (
        <LoadingState message={t("challengeCreate.loading")} />
      ) : null}
      {data.loadState === "error" ? (
        <View style={styles.centered}>
          <ErrorState
            title={t("challengeCreate.loadErrorTitle")}
            message={data.error ?? t("challengeCreate.loadErrorMessage")}
            retryLabel={t("common.tryAgain")}
            onRetry={data.retry}
          />
        </View>
      ) : null}
      {data.loadState === "ready" ? <ReadySheet screen={screen} /> : null}
    </View>
  );
}

function ReadySheet({ screen }: { screen: ChallengeCreateScreen }) {
  const { t, data, draft, you, submitState } = screen;
  const step = draft.draft.step;
  const entering = screen.stepDirection === "forward" ? ENTER_FORWARD : ENTER_BACKWARD;
  const sending = submitState.status === "sending";
  const hint = issueHint(draft.stepIssue, t, draft.selectedFriend?.username);
  const hasFriends = data.friends.length > 0;
  const { dispatch } = draft;
  const selectFriend = useCallback(
    (friendId: number) => dispatch({ type: "selectFriend", friendId }),
    [dispatch],
  );

  return (
    <>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step} entering={entering} style={styles.stepContent}>
          {step === "friend" ? (
            <FriendStep
              t={t}
              friends={data.friends}
              statuses={draft.friendStatuses}
              selectedFriendId={draft.draft.friendId}
              onSelect={selectFriend}
              onAddFriend={screen.openAddFriend}
            />
          ) : null}
          {step === "goal" ? <GoalStep t={t} controller={draft} /> : null}
          {step === "review" && draft.selectedFriend ? (
            <ReviewStep
              t={t}
              controller={draft}
              you={you}
              friend={draft.selectedFriend}
              errorMessage={submitState.status === "error" ? (submitState.message ?? "") : null}
            />
          ) : null}
        </Animated.View>
      </ScrollView>
      {hasFriends ? (
        <View style={styles.footer}>
          {hint ? (
            <Text
              style={[
                styles.footerHint,
                draft.stepIssue === "invite_pending" && styles.footerHintWarning,
              ]}
              accessibilityLiveRegion="polite"
            >
              {hint}
            </Text>
          ) : null}
          <PrimaryButton
            testID="challenge-create-continue"
            label={t(step === "review" ? "challengeCreate.send" : "challengeCreate.continue")}
            disabled={!draft.canContinue}
            loading={sending}
            onPress={screen.continueOrSend}
          />
        </View>
      ) : null}
    </>
  );
}

function issueHint(
  issue: ChallengeDraftIssue | null,
  t: TFunction,
  friendName: string | undefined,
) {
  if (issue === "pick_friend") return t("challengeCreate.hintPickFriend");
  if (issue === "invite_pending")
    return t("challengeCreate.hintInvitePending", { friend: friendName ?? "" });
  if (issue === "title_too_short") return t("challengeCreate.hintTitleShort");
  if (issue === "title_too_long") return t("challengeCreate.hintTitleLong");
  return null;
}
