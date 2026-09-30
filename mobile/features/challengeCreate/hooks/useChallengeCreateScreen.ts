import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import { parseProfileUserId, profilePictureUrl } from "../../profile/friendProfilePresentation";
import { useChallengeCreateData } from "./useChallengeCreateData";
import { useChallengeDraft } from "./useChallengeDraft";
import { useChallengeSubmit } from "./useChallengeSubmit";

const SENT_AUTO_CLOSE_MS = 1800;

export function useChallengeCreateScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const { friendId } = useLocalSearchParams<{ friendId?: string }>();
  const data = useChallengeCreateData(token, user?.id);
  const you = {
    name: user?.username ?? t("challengeCreate.you"),
    photoUri: profilePictureUrl(user?.profile_picture_url),
  };
  const draft = useChallengeDraft({
    friends: data.friends,
    challenges: data.challenges,
    userId: user?.id,
    yourName: you.name,
    initialFriendId: parseProfileUserId(friendId),
  });
  const { submitState, submit } = useChallengeSubmit(token, user?.id);

  const close = useCallback(() => router.back(), [router]);
  const openAddFriend = useCallback(
    () => router.dismissTo({ pathname: "/(tabs)/friends", params: { addFriend: "1" } }),
    [router],
  );

  useEffect(() => {
    if (submitState.status !== "sent") return;
    const timer = setTimeout(close, SENT_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [close, submitState.status]);

  const { dispatch, request } = draft;
  const isReview = draft.draft.step === "review";
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");
  const continueOrSend = useCallback(() => {
    if (isReview) {
      void submit(request);
      return;
    }
    setStepDirection("forward");
    dispatch({ type: "next" });
  }, [dispatch, isReview, request, submit]);
  const goBack = useCallback(() => {
    setStepDirection("backward");
    dispatch({ type: "back" });
  }, [dispatch]);

  return {
    t,
    data,
    draft,
    you,
    submitState,
    stepDirection,
    close,
    openAddFriend,
    continueOrSend,
    goBack,
  };
}

export type ChallengeCreateScreen = ReturnType<typeof useChallengeCreateScreen>;
