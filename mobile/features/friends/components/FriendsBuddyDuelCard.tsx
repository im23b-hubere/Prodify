import type { TFunction } from "i18next";
import { memo } from "react";

import { DuelScoreboard } from "../../challenges/components/DuelScoreboard";

type Props = {
  t: TFunction;
  buddyName: string;
  yourSessions: number;
  buddySessions: number;
  onCatchUp: () => void;
};

export const FriendsBuddyDuelCard = memo(function FriendsBuddyDuelCard({
  t,
  buddyName,
  yourSessions,
  buddySessions,
  onCatchUp,
}: Props) {
  const behind = buddySessions > yourSessions;
  const quiet = yourSessions === 0 && buddySessions === 0;
  const actionLabel = behind
    ? t("friendsScreen.heroCtaCatchUp")
    : quiet
      ? t("friendsScreen.heroCtaStartSession")
      : null;
  return (
    <DuelScoreboard
      t={t}
      leftLabel={t("friendsScreen.buddyDuelYouLabel")}
      leftScore={yourSessions}
      rightLabel={buddyName}
      rightScore={buddySessions}
      meta={t("friendsScreen.modeWeek")}
      actionLabel={actionLabel}
      onAction={actionLabel ? onCatchUp : undefined}
      testID="friends-buddy-duel"
    />
  );
});
